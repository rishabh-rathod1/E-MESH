"""
Node service — CRUD and status management for mesh nodes.
"""
from __future__ import annotations

from typing import List, Optional, Tuple

from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.enums import NodeStatus
from app.core.exceptions import AlreadyExistsError, NotFoundError
from app.models.node import Node
from app.models.node_link import NodeLink
from app.models.node_telemetry import NodeTelemetry
from app.schemas.node import NodeCreate, NodeUpdate


async def get_node_by_id(session: AsyncSession, node_id: str) -> Optional[Node]:
    result = await session.execute(select(Node).where(Node.id == node_id))
    return result.scalar_one_or_none()


async def get_node_by_node_id(session: AsyncSession, node_id: str) -> Optional[Node]:
    result = await session.execute(select(Node).where(Node.node_id == node_id))
    return result.scalar_one_or_none()


async def list_nodes(
    session: AsyncSession,
    status: Optional[NodeStatus] = None,
    page: int = 1,
    page_size: int = 50,
) -> Tuple[List[Node], int]:
    query = select(Node)
    if status:
        query = query.where(Node.status == status)

    count_result = await session.execute(select(func.count()).select_from(query.subquery()))
    total = count_result.scalar_one()

    query = query.offset((page - 1) * page_size).limit(page_size).order_by(Node.node_id)
    result = await session.execute(query)
    return list(result.scalars().all()), total


async def create_node(session: AsyncSession, data: NodeCreate) -> Node:
    existing = await get_node_by_node_id(session, data.node_id)
    if existing:
        raise AlreadyExistsError("Node", data.node_id)

    node = Node(
        node_id=data.node_id,
        display_name=data.display_name or data.node_id,
        is_gateway=data.is_gateway,
        status=NodeStatus.UNKNOWN,
        position_x=data.position_x,
        position_y=data.position_y,
    )
    session.add(node)
    await session.flush()
    return node


async def update_node(session: AsyncSession, node_id: str, data: NodeUpdate) -> Node:
    node = await get_node_by_id(session, node_id)
    if not node:
        raise NotFoundError("Node", node_id)

    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(node, field, value)

    await session.flush()
    return node


async def delete_node(session: AsyncSession, node_id: str) -> None:
    # Accept either database primary key (UUID) or human-readable node_id
    node = await get_node_by_id(session, node_id)
    if not node:
        node = await get_node_by_node_id(session, node_id)
    if not node:
        raise NotFoundError("Node", node_id)

    # Explicitly clean up all connected links and telemetry records to prevent integrity errors
    await session.execute(
        delete(NodeLink).where(
            (NodeLink.source_node_id == node.id) | (NodeLink.target_node_id == node.id)
        )
    )
    await session.execute(
        delete(NodeTelemetry).where(NodeTelemetry.node_id == node.node_id)
    )
    await session.delete(node)
    await session.flush()


async def get_links_for_node(session: AsyncSession, node_db_id: str) -> List[NodeLink]:
    result = await session.execute(
        select(NodeLink).where(
            (NodeLink.source_node_id == node_db_id) | (NodeLink.target_node_id == node_db_id)
        )
    )
    return list(result.scalars().all())


async def list_all_links(session: AsyncSession) -> List[NodeLink]:
    result = await session.execute(select(NodeLink))
    return list(result.scalars().all())


async def upsert_node_link(
    session: AsyncSession,
    source_db_id: str,
    target_db_id: str,
    rssi_dbm: Optional[float] = None,
    packet_loss_percent: float = 0.0,
    latency_ms: Optional[float] = None,
) -> NodeLink:
    """Upsert a directed link between two nodes (identified by their DB primary keys)."""
    from datetime import datetime, timezone
    from app.core.enums import NodeLinkStatus

    result = await session.execute(
        select(NodeLink).where(
            (NodeLink.source_node_id == source_db_id) &
            (NodeLink.target_node_id == target_db_id)
        )
    )
    link = result.scalar_one_or_none()

    now = datetime.now(timezone.utc)
    if link:
        if rssi_dbm is not None:
            link.rssi_dbm = rssi_dbm
        link.packet_loss_percent = packet_loss_percent
        if latency_ms is not None:
            link.latency_ms = latency_ms
        link.last_seen = now
        # Auto-upgrade/downgrade status based on quality
        if packet_loss_percent >= 80:
            link.status = NodeLinkStatus.DOWN
        elif packet_loss_percent >= 20 or (rssi_dbm is not None and rssi_dbm < -85):
            link.status = NodeLinkStatus.DEGRADED
        else:
            link.status = NodeLinkStatus.ACTIVE
    else:
        link = NodeLink(
            source_node_id=source_db_id,
            target_node_id=target_db_id,
            rssi_dbm=rssi_dbm,
            packet_loss_percent=packet_loss_percent,
            latency_ms=latency_ms,
            last_seen=now,
        )
        session.add(link)

    await session.flush()
    return link

