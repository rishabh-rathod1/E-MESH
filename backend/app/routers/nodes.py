"""
Nodes router — mesh node CRUD with RBAC.
"""
from __future__ import annotations

import math
from typing import Annotated, Optional

from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_db, require_roles
from app.core.enums import NodeStatus, UserRole
from app.core.exceptions import NotFoundError
from app.models.user import User
from app.schemas.common import PaginatedResponse, SuccessResponse
from app.schemas.node import NodeCreate, NodeLinkRead, NodeRead, NodeUpdate, NodeTelemetryRead
from app.services.audit_service import write_audit
from app.services.network_event_service import (
    emit_node_offline,
    emit_node_online,
    emit_node_updated,
    emit_topology_updated,
)
from app.services.node_service import (
    create_node,
    delete_node,
    get_node_by_id,
    get_links_for_node,
    list_all_links,
    list_nodes,
    update_node,
)

router = APIRouter(prefix="/nodes", tags=["Nodes"])

_admin_only = require_roles(UserRole.ADMIN)
_privileged = require_roles(UserRole.ADMIN, UserRole.INCIDENT_MANAGER, UserRole.VIEWER, UserRole.RESPONDER)


@router.get("", response_model=PaginatedResponse[NodeRead], summary="List all nodes")
async def list_nodes_endpoint(
    db: Annotated[AsyncSession, Depends(get_db)],
    _actor: Annotated[User, Depends(_privileged)],
    status: Optional[NodeStatus] = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
):
    nodes, total = await list_nodes(db, status=status, page=page, page_size=page_size)
    return PaginatedResponse(
        data=[NodeRead.model_validate(n) for n in nodes],
        total=total,
        page=page,
        page_size=page_size,
        total_pages=math.ceil(total / page_size) if total else 0,
    )


@router.post("", response_model=NodeRead, status_code=201, summary="Create a node")
async def create_node_endpoint(
    request: Request,
    body: NodeCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    actor: Annotated[User, Depends(_admin_only)],
):
    node = await create_node(db, body)
    await write_audit(
        db, "node.created", actor=actor, entity_type="Node", entity_id=node.id,
        metadata={"node_id": body.node_id},
        ip_address=request.client.host if request.client else None,
    )

    emit_node_online(
        node_id=node.node_id,
        name=node.display_name or node.node_id,
        battery_level=node.battery_percent,
        signal_quality=node.rssi_dbm,
        hop_count=node.neighbour_count,
    )
    return NodeRead.model_validate(node)


@router.get("/links", response_model=list[NodeLinkRead], summary="Get all node links (topology)")
async def list_links_endpoint(
    db: Annotated[AsyncSession, Depends(get_db)],
    _actor: Annotated[User, Depends(_privileged)],
):
    links = await list_all_links(db)
    return [NodeLinkRead.model_validate(lnk) for lnk in links]


@router.get("/topology", summary="Get complete mesh topology (nodes + links) with layout metadata")
async def get_topology_endpoint(
    db: Annotated[AsyncSession, Depends(get_db)],
    _actor: Annotated[User, Depends(_privileged)],
):
    """
    Returns all real hardware nodes and their links with enriched layout metadata:
    - root_id: node_id of the gateway node (or first online node)
    - max_depth: maximum tree depth computed from link structure
    - Each node includes: layer (depth level), current_route (parsed list)
    """
    import json
    import uuid
    from collections import defaultdict, deque

    nodes, _ = await list_nodes(db, page=1, page_size=200)
    links = await list_all_links(db)

    node_reads = [NodeRead.model_validate(n).model_dump() for n in nodes]
    link_reads = [NodeLinkRead.model_validate(lnk).model_dump() for lnk in links]

    # ── Determine root / gateway ──────────────────────────────────────────
    # neighbour_count stores the live hop depth (1 = root, 2 = one-hop relay, ...)
    # reported fresh from esp_mesh_lite_get_level() each heartbeat.
    # is_gateway can be stale if the root has rotated since last heartbeat.
    # Priority: 1) ONLINE node with neighbour_count=1  2) any node with neighbour_count=1
    #           3) node with is_gateway=True  4) first node
    root_node = (
        next((n for n in nodes if n.neighbour_count == 1 and n.status.value == 'ONLINE'), None)
        or next((n for n in nodes if n.neighbour_count == 1), None)
        or next((n for n in nodes if n.is_gateway), None)
        or (nodes[0] if nodes else None)
    )
    root_id = root_node.node_id if root_node else "GATEWAY"

    # Build id→node_id lookup (links use DB id as source/target)
    id_to_nodeid: dict[str, str] = {n.id: n.node_id for n in nodes}

    # ── Prefer stored hop depth (neighbour_count) when available ─────────
    # ESP32 firmware sends hop_count (layer depth from root), which is stored in
    # neighbour_count via NodeUpdate.sync_aliases. Use it directly when no links exist.
    stored_layers: dict[str, int] = {}
    for n in nodes:
        # neighbour_count holds the hop depth when set by firmware heartbeat
        if n.neighbour_count and n.neighbour_count >= 1:
            stored_layers[n.node_id] = n.neighbour_count

    # ── BFS from root using NodeLink edges (more accurate when links present) ─
    adj: dict[str, set[str]] = defaultdict(set)
    for lnk in links:
        src_nid = id_to_nodeid.get(lnk.source_node_id)
        tgt_nid = id_to_nodeid.get(lnk.target_node_id)
        if src_nid and tgt_nid:
            adj[src_nid].add(tgt_nid)
            adj[tgt_nid].add(src_nid)

    bfs_layers: dict[str, int] = {}
    if links and nodes:
        queue = deque([(root_id, 1)])
        visited = {root_id}
        while queue:
            nid, depth = queue.popleft()
            bfs_layers[nid] = depth
            for neighbor in adj.get(nid, []):
                if neighbor not in visited:
                    visited.add(neighbor)
                    queue.append((neighbor, depth + 1))

    # ── Merge: BFS wins when links exist; fall back to stored hop depth ───
    layers: dict[str, int] = {}
    for n in nodes:
        nid = n.node_id
        if nid in bfs_layers:
            layers[nid] = bfs_layers[nid]
        elif nid in stored_layers:
            layers[nid] = stored_layers[nid]
        else:
            layers[nid] = 1  # unknown — place at root level

    max_depth = max(layers.values(), default=1)

    # ── Enrich node dicts with layer & parsed current_route ───────────────
    for nd in node_reads:
        nd["layer"] = layers.get(nd["node_id"], 1)
        raw_route = nd.get("current_route")
        if raw_route and isinstance(raw_route, str):
            try:
                nd["current_route"] = json.loads(raw_route)
            except (ValueError, TypeError):
                nd["current_route"] = []
        elif raw_route is None:
            nd["current_route"] = []

    # ── Enrich or synthesize links ──────────────────────────────────────
    if links:
        for lk in link_reads:
            lk["source_node_id"] = id_to_nodeid.get(lk["source_node_id"], lk["source_node_id"])
            lk["target_node_id"] = id_to_nodeid.get(lk["target_node_id"], lk["target_node_id"])
    elif len(nodes) > 1:
        # Auto-generate visual links if none exist based on computed layer depth
        mock_links = []
        by_layer: dict[int, list] = {}
        for nd in node_reads:
            lyr = nd["layer"]
            by_layer.setdefault(lyr, []).append(nd)

        for lyr in sorted(by_layer.keys()):
            if lyr <= 1:
                continue
            parents = by_layer.get(lyr - 1, [])
            if not parents:
                parents = [p for p in node_reads if p["layer"] < lyr]

            for child in by_layer[lyr]:
                parent = parents[hash(child["node_id"]) % len(parents)] if parents else None
                if parent:
                    mock_links.append({
                        "id": str(uuid.uuid4()),
                        "source_node_id": child["node_id"],
                        "target_node_id": parent["node_id"],
                        "rssi_dbm": child.get("rssi_dbm"),
                        "packet_loss_percent": child.get("packet_loss_percent", 0.0),
                        "latency_ms": 15.0,
                        "status": "ACTIVE",
                        "last_seen": child.get("last_heartbeat"),
                    })
        link_reads = mock_links

    return {
        "root_id": root_id,
        "max_depth": max_depth,
        "nodes": node_reads,
        "links": link_reads,
    }



@router.get("/{node_id}", response_model=NodeRead, summary="Get a node by ID")
async def get_node_endpoint(
    node_id: str,
    db: Annotated[AsyncSession, Depends(get_db)],
    _actor: Annotated[User, Depends(_privileged)],
):
    node = await get_node_by_id(db, node_id)
    if not node:
        raise NotFoundError("Node", node_id)
    return NodeRead.model_validate(node)


@router.patch("/{node_id}", response_model=NodeRead, summary="Update a node")
async def update_node_endpoint(
    request: Request,
    node_id: str,
    body: NodeUpdate,
    db: Annotated[AsyncSession, Depends(get_db)],
    actor: Annotated[User, Depends(_admin_only)],
):
    node = await update_node(db, node_id, body)
    await write_audit(
        db, "node.updated", actor=actor, entity_type="Node", entity_id=node_id,
        metadata=body.model_dump(exclude_unset=True),
        ip_address=request.client.host if request.client else None,
    )

    emit_node_updated(
        node_id=node.node_id,
        name=node.display_name or node.node_id,
        status=node.status.value if hasattr(node.status, 'value') else str(node.status),
        battery_level=node.battery_percent,
        signal_quality=node.rssi_dbm,
        hop_count=node.neighbour_count,
    )
    return NodeRead.model_validate(node)


@router.delete("/{node_id}", response_model=SuccessResponse, summary="Delete a node")
async def delete_node_endpoint(
    request: Request,
    node_id: str,
    db: Annotated[AsyncSession, Depends(get_db)],
    actor: Annotated[User, Depends(_admin_only)],
):
    node = await get_node_by_id(db, node_id)
    name = (node.display_name or node.node_id) if node else node_id
    nid = node.node_id if node else node_id

    await delete_node(db, node_id)
    await write_audit(
        db, "node.deleted", actor=actor, entity_type="Node", entity_id=node_id,
        ip_address=request.client.host if request.client else None,
    )

    emit_node_offline(node_id=nid, name=name)
    return SuccessResponse(message="Node deleted")


@router.get("/{node_id}/links", response_model=list[NodeLinkRead], summary="Get links for a specific node")
async def get_node_links(
    node_id: str,
    db: Annotated[AsyncSession, Depends(get_db)],
    _actor: Annotated[User, Depends(_privileged)],
):
    node = await get_node_by_id(db, node_id)
    if not node:
        raise NotFoundError("Node", node_id)
    links = await get_links_for_node(db, node.id)
    return [NodeLinkRead.model_validate(lnk) for lnk in links]


@router.get("/{node_id}/telemetry", response_model=list[NodeTelemetryRead], summary="Get time-series telemetry for a specific node")
async def get_node_telemetry(
    node_id: str,
    db: Annotated[AsyncSession, Depends(get_db)],
    _actor: Annotated[User, Depends(_privileged)],
    limit: int = Query(100, ge=1, le=1000)
):
    from sqlalchemy import select
    from app.models.node_telemetry import NodeTelemetry
    
    node = await get_node_by_id(db, node_id)
    if not node:
        raise NotFoundError("Node", node_id)
        
    result = await db.execute(
        select(NodeTelemetry)
        .where(NodeTelemetry.node_id == node.node_id)
        .order_by(NodeTelemetry.timestamp.desc())
        .limit(limit)
    )
    telemetry = result.scalars().all()
    # Return ascending order for charts
    return [NodeTelemetryRead.model_validate(t) for t in reversed(telemetry)]
