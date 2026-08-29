"""
Node schemas.
"""
from __future__ import annotations

from datetime import datetime
from typing import List, Optional

from pydantic import Field, model_validator

from app.core.enums import NodeStatus
from app.schemas.common import EMeshBaseModel


class NodeCreate(EMeshBaseModel):
    node_id: str = Field(..., min_length=2, max_length=32)
    display_name: Optional[str] = None
    name: Optional[str] = None
    is_gateway: bool = False
    battery_level: Optional[float] = None
    signal_quality: Optional[float] = None
    hop_count: Optional[int] = None
    position_x: Optional[float] = None
    position_y: Optional[float] = None

    @model_validator(mode="after")
    def populate_aliases(self) -> "NodeCreate":
        if self.name and not self.display_name:
            self.display_name = self.name
        return self


class NodeRead(EMeshBaseModel):
    id: str
    node_id: str
    display_name: Optional[str] = None
    status: NodeStatus
    is_gateway: bool
    uptime_seconds: int
    battery_percent: Optional[float] = None
    rssi_dbm: Optional[float] = None
    neighbour_count: int
    packet_rx: int
    packet_tx: int
    packet_loss_percent: float
    queue_depth: int
    current_route: Optional[str] = None
    last_heartbeat: Optional[datetime] = None
    position_x: Optional[float] = None
    position_y: Optional[float] = None
    created_at: datetime
    updated_at: datetime

    @property
    def name(self) -> Optional[str]:
        return self.display_name or self.node_id

    @property
    def battery_level(self) -> Optional[float]:
        return self.battery_percent

    @property
    def signal_quality(self) -> Optional[float]:
        return self.rssi_dbm

    @property
    def hop_count(self) -> int:
        return 1


class NodeUpdate(EMeshBaseModel):
    display_name: Optional[str] = None
    name: Optional[str] = None
    status: Optional[NodeStatus] = None
    battery_percent: Optional[float] = Field(None, ge=0.0, le=100.0)
    battery_level: Optional[float] = Field(None, ge=0.0, le=100.0)
    rssi_dbm: Optional[float] = None
    signal_quality: Optional[float] = None
    packet_loss_percent: Optional[float] = Field(None, ge=0.0, le=100.0)
    queue_depth: Optional[int] = Field(None, ge=0)
    hop_count: Optional[int] = None
    position_x: Optional[float] = None
    position_y: Optional[float] = None

    @model_validator(mode="after")
    def sync_aliases(self) -> "NodeUpdate":
        if self.name and not self.display_name:
            self.display_name = self.name
        if self.battery_level is not None and self.battery_percent is None:
            self.battery_percent = self.battery_level
        if self.signal_quality is not None and self.rssi_dbm is None:
            self.rssi_dbm = self.signal_quality
        return self


class NodeLinkRead(EMeshBaseModel):
    id: str
    source_node_id: str
    target_node_id: str
    rssi_dbm: Optional[float] = None
    packet_loss_percent: float
    latency_ms: Optional[float] = None
    status: str
    last_seen: Optional[datetime] = None
