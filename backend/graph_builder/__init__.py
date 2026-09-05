"""TG-Detect graph construction layer.

RAW LOGS -> dataset parser -> TGEvent -> normalizer -> temporal heterogeneous
graph -> attack chain tracking -> parquet (TGNN-ready).

This layer is deliberately independent of the TGNN training code.
"""

from .schema import (  # noqa: F401
    CHAIN_SCHEMA,
    EDGE_SCHEMA,
    EVENT_SCHEMA,
    NODE_SCHEMA,
    NodeType,
    RelationType,
    TGEvent,
)
from .normalizer import (  # noqa: F401
    NormalizationStats,
    canonical_id,
    coerce_ts,
    infer_node_type,
    normalize_event,
    normalize_stream,
)
from .parsers import PARSERS, get_parser  # noqa: F401
from .builder import GraphStats, StreamingGraphBuilder, TemporalGraphBuilder  # noqa: F401
from .attack_tracker import (  # noqa: F401
    AttackChain,
    AttackTracker,
    CausalParentTracker,
    ChainIdTracker,
    EntityTimeTracker,
)
from .exporters import (  # noqa: F401
    GraphExporter,
    ParquetStreamWriter,
    write_chain_subgraphs,
    write_chain_summary,
    write_stats,
)

__version__ = "0.1.0"
