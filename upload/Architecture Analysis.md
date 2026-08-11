# TG-Detect v16 Architecture Analysis (Apex TGNN)

Here is a comprehensive breakdown of the `V16_Apex` TGNN architecture, the features it uses, and how it compares to the baseline GNN model.

## 1. Data Features Extracted
The architecture consumes a rich set of both structural and statistical features from the log events:

* **Node Identities:** Source ID (`src_id`) and Destination ID (`dst_id`). These are hashed using MD5 into 10,000 buckets.
* **Numeric Attributes:** 
  * `frequency`: Frequency of interaction.
  * `temporal_burst`: Burstiness of the event in a short time window.
  * `rarity`: How rare this type of interaction is.
* **Temporal Features:** `dt` (Time Delta), representing the elapsed time since the specific node's last recorded interaction.
* **Auxiliary Labels (for advanced training):** 
  * `source_tag` (Dataset domain like DARPA, UNSW, LANL).
  * `tactics` (The MITRE ATT&CK tactic, e.g., Lateral Movement, Exfiltration).

## 2. Core TGNN Components & Their Purpose
The V16 TGNN architecture is a highly specialized Temporal Graph Neural Network designed for continuous, out-of-distribution (OOD) threat detection.

### `UniversalEncoder` (Node Representation)
* **Purpose:** Replaces standard ID-only embeddings by projecting and concatenating both the Hashed Node IDs and the 3 numeric attributes (`frequency`, `temporal_burst`, `rarity`) through a 2-layer MLP (GELU).
* **Why it matters:** Allows the model to generalize to unseen nodes (zero-shot) because it relies on behavioral numeric traits rather than just memorized IDs.

### `MultiResTimeEncoder` (Temporal Encoding)
* **Purpose:** Converts the raw elapsed time (`dt`) into a 32-dimensional dense vector (`TIME_DIM = 32`).
* **Mechanism:** Uses learned fine and coarse frequency parameters via Cosine functions (similar to positional encoding in Transformers) to capture both micro-bursts and long-term delays.

### `MemBank` with `GRUCell` (Dynamic Memory)
* **Purpose:** Gives the graph a "memory" of past interactions.
* **Mechanism:** Every node has a 64-dimensional memory state (`MEMORY_DIM = 64`). Unlike standard memory, V16 applies **exponential time-decay**. If a node is inactive for a long time, its memory naturally decays. The decay rate is also influenced by the node's past **risk score** (high-risk nodes decay slower). It is updated continuously using a recurrent `GRUCell`.

### `CausalHTAConv` (Causal Heterogeneous Temporal Attention)
* **Purpose:** The core message-passing mechanism between source and destination nodes.
* **Architecture:** 
  * **Layers:** 2 (`N_LAYERS = 2`)
  * **Attention Heads:** 4 (`NUM_HEADS = 4`), with 16 dimensions per head (`EMBED_DIM = 64`).
* **Mechanism:** Computes attention (Q, K, V) over the concatenated source state, destination state, and the temporal encoding. Crucially, it applies a **Causal Mask** (`dt > 1e-4`), ensuring information only flows forward in time and preventing "temporal leakage" (where future data improperly influences the past).

### `GRL` (Gradient Reversal Layer) & Domain Head
* **Purpose:** Forces the model to learn **domain-invariant** features.
* **Mechanism:** During backpropagation, the gradients from the domain classification head are reversed. This prevents the TGNN from memorizing dataset-specific quirks (e.g., LANL vs. DARPA), drastically improving cross-dataset generalization.

### `SupervisedContrastiveLoss`
* **Purpose:** Enhances representation quality by clustering similar attack behaviors.
* **Mechanism:** Pulls the embeddings of events with the same attack tactic (e.g., all "Initial Access" events) closer together in the latent space, while pushing different tactics apart.

---

## 3. Architecture Comparison: TGNN (V16) vs. GNN+Reh CL (V13 / Pomsathit)

The baseline model (V13) replicates standard literature approaches (like Pomsathit 2025) which rely primarily on structural GNNs and simple Rehearsal buffers. Here is how our TGNN upgrades every stage of the pipeline:

| Feature / Mechanism | `V13_GNN_Rehearsal` (Baseline) | `V16_Apex` (Our TGNN) |
| :--- | :--- | :--- |
| **Node Embedding** | Standard PyTorch `nn.Embedding` on hashed IDs only. Cannot generalize well to unseen nodes. | **`UniversalEncoder`**: Combines Hash IDs with behavioral numeric features (`frequency`, `burst`, `rarity`). |
| **Message Passing** | Standard Softmax Attention (`is_causal=False`). Susceptible to temporal smoothing. | **`CausalHTAConv`**: 4-head attention with strict **Causal Masking** to respect strict time order. |
| **Memory Updates** | Simple `tanh` activation. Memory is retrieved raw and static. | **`GRUCell` Update**: Memory retrieval applies an **exponential time-decay** modulated by past risk scores. |
| **Continual Learning** | Simple Rehearsal Buffer (replaying old samples). | **Joint Rehearsal + GRL + Contrastive Loss**: Replays snapshots *while* forcing domain-invariance and tactic clustering. |
| **Loss Function** | `FocalBCE` (Anomaly Detection only). | **Multi-Task Objective**: `FocalBCE` (Main) + `CrossEntropy` (GRL Domain) + `SupCon` (Tactics). |

### Summary of Performance Impact
Because the V13 baseline lacks temporal decay, causal masking, and behavioral feature projection, it struggles severely when deployed on Out-Of-Distribution (OOD) data or when tracking slow, multi-stage APTs (where time gaps are large). 

Our V16 TGNN solves this by directly encoding time (`MultiResTimeEncoder`), decaying irrelevant past memory, and forcing the model to ignore domain-specific noise via the Gradient Reversal Layer.