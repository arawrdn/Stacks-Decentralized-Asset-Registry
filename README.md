# stacks-decentralized-asset-registry

## Project Overview: Secure Off-Chain Data Auditing

The Stacks Decentralized Asset Registry (SDAR) provides a mechanism to cryptographically secure the integrity of dynamic, off-chain data (such as inventory, logistics logs, or audit reports) managed in **Google Sheets**. By recording the SHA-256 hash of the sheet data onto the Stacks blockchain, we create an immutable, publicly verifiable record that proves the data has not been tampered with since the time of recording.

### Architecture

The system operates using three core layers:

1.  **Data Layer (Google Sheets):** The user-friendly interface for managing asset data.
2.  **Middleware Layer (Node.js Server):** Reads data from Sheets, computes the cryptographic hash, and broadcasts the Stacks transaction.
3.  **Blockchain Layer (Clarity Contract):** The immutable storage for the data hash, anchored to the Bitcoin network via Stacks.



### Setup and Installation

#### 1. Prerequisites

* Node.js (v18+)
* An operational Stacks node/API endpoint.
* A Google Cloud Project with the Sheets API enabled and a Service Account created for authentication.
