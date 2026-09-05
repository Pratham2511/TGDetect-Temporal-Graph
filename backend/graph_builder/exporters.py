"""Incremental parquet + JSON exporters. Nothing is fully buffered in memory."""

from __future__ import annotations

import json
import os
from typing import Any, Dict, Iterable, List, Optional

import pyarrow as pa
import pyarrow.parquet as pq

from .schema import CHAIN_SCHEMA, EDGE_SCHEMA, EVENT_SCHEMA, NODE_SCHEMA


class ParquetStreamWriter:
    """Buffers rows and flushes row groups to a parquet file."""

    def __init__(self, path: str, schema: pa.Schema, chunk_size: int = 100_000,
                 compression: str = "snappy") -> None:
        os.makedirs(os.path.dirname(os.path.abspath(path)), exist_ok=True)
        self.path = path
        self.schema = schema
        self.chunk_size = chunk_size
        self._buffer: List[Dict[str, Any]] = []
        self._writer = pq.ParquetWriter(path, schema, compression=compression)
        self.rows_written = 0

    def write(self, row: Dict[str, Any]) -> None:
        self._buffer.append(row)
        if len(self._buffer) >= self.chunk_size:
            self.flush()

    def write_many(self, rows: Iterable[Dict[str, Any]]) -> None:
        for row in rows:
            self.write(row)

    def flush(self) -> None:
        if not self._buffer:
            return
        table = pa.Table.from_pylist(self._buffer, schema=self.schema)
        self._writer.write_table(table)
        self.rows_written += len(self._buffer)
        self._buffer.clear()

    def close(self) -> None:
        self.flush()
        self._writer.close()

    def __enter__(self) -> "ParquetStreamWriter":
        return self

    def __exit__(self, *exc: Any) -> None:
        self.close()


class GraphExporter:
    """Writes events.parquet + edges.parquet while streaming; nodes at the end."""

    def __init__(self, out_dir: str, chunk_size: int = 100_000,
                 write_edges: bool = True) -> None:
        os.makedirs(out_dir, exist_ok=True)
        self.out_dir = out_dir
        self.events = ParquetStreamWriter(
            os.path.join(out_dir, "events.parquet"), EVENT_SCHEMA, chunk_size
        )
        self.edges = (
            ParquetStreamWriter(os.path.join(out_dir, "edges.parquet"), EDGE_SCHEMA, chunk_size)
            if write_edges
            else None
        )

    def write_event(self, event) -> None:
        self.events.write(event.to_row())
        if self.edges is not None:
            self.edges.write(event.edge_row())

    def stream_events(self, events: Iterable):
        for event in events:
            self.write_event(event)
            yield event

    def write_nodes(self, node_rows: Iterable[Dict[str, Any]],
                    chunk_size: int = 100_000) -> int:
        with ParquetStreamWriter(
            os.path.join(self.out_dir, "nodes.parquet"), NODE_SCHEMA, chunk_size
        ) as writer:
            writer.write_many(node_rows)
            count = writer.rows_written + len(writer._buffer)
        return count

    def close(self) -> None:
        self.events.close()
        if self.edges is not None:
            self.edges.close()


def write_chain_summary(out_dir: str, chains: Iterable[Any]) -> int:
    os.makedirs(out_dir, exist_ok=True)
    path = os.path.join(out_dir, "chains_summary.parquet")
    with ParquetStreamWriter(path, CHAIN_SCHEMA, chunk_size=10_000) as writer:
        count = 0
        for chain in chains:
            writer.write(chain.to_row())
            count += 1
    return count


def write_chain_subgraphs(graphs_dir: str, chains: Iterable[Any],
                          max_files: Optional[int] = 1000) -> int:
    chains_dir = os.path.join(graphs_dir, "chains")
    os.makedirs(chains_dir, exist_ok=True)
    written = 0
    for chain in chains:
        if max_files is not None and written >= max_files:
            break
        safe = "".join(c if c.isalnum() or c in "-_" else "_" for c in chain.chain_id)
        with open(os.path.join(chains_dir, f"{safe}.json"), "w", encoding="utf-8") as fh:
            json.dump(chain.to_subgraph(), fh, indent=2, default=str)
        written += 1
    return written


def write_stats(out_dir: str, stats: Dict[str, Any], filename: str = "graph_stats.json") -> str:
    os.makedirs(out_dir, exist_ok=True)
    path = os.path.join(out_dir, filename)
    with open(path, "w", encoding="utf-8") as fh:
        json.dump(stats, fh, indent=2, default=str)
    return path
