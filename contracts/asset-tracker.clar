```clarity
;; asset-tracker.clar
;; Smart contract for recording immutable asset data hashes on Stacks.

(define-constant err-not-authorized (err u100))
(define-constant err-asset-exists (err u101))
(define-constant HASH_LENGTH u32) ;; Standard SHA256 length is 32 bytes

;; Data Maps: Maps a unique Asset ID to its recorded hash and metadata.
(define-map asset-records (string-ascii 64) ({
    asset-id: (string-ascii 64),
    data-hash: (buff HASH_LENGTH),
    timestamp: uint,
    recorded-by: principal
}))

;; Data Variables
(define-data-var registry-owner principal tx-sender)

;; --- Public Functions ---

;; @desc Records a cryptographic hash (proof of existence) for an asset ID.
;; @param asset-id A unique ID for the asset batch (e.g., Batch-001).
;; @param data-hash The SHA-256 hash of the off-chain Google Sheets data corresponding to this asset ID.
(define-public (record-asset-hash (asset-id (string-ascii 64)) (data-hash (buff HASH_LENGTH)))
    (begin
        ;; Only the authorized registry owner (the middleware's address) can record hashes
        (asserts! (is-eq tx-sender (var-get registry-owner)) err-not-authorized)
        
        ;; Ensure the asset ID is not recorded yet
        (asserts! (is-none (map-get? asset-records asset-id)) err-asset-exists)

        (map-set asset-records asset-id {
            asset-id: asset-id,
            data-hash: data-hash,
            timestamp: (get block-height),
            recorded-by: tx-sender
        })
        
        ;; Emit event for external systems to monitor the recording
        (print {event: "ASSET_HASH_RECORDED", id: asset-id, hash: data-hash, block: (get block-height)})
        
        (ok true)
)
)

;; --- Read-Only Functions ---

;; @desc Retrieves the recorded hash and metadata for an asset ID.
(define-read-only (get-asset-record (asset-id (string-ascii 64)))
    (ok (map-get? asset-records asset-id))
)
