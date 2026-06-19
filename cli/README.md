# Nova Verify CLI

A comprehensive command-line interface for managing proofs, deploying contracts, and interacting with the Nova Verify platform programmatically.

## Installation

```bash
npm install -g nova-verify-cli
```

## Configuration

Before using the CLI, configure your environment:

```bash
# Set API endpoint
nova-verify config set apiUrl https://api.nova-verify.com

# Login to authenticate
nova-verify auth login
```

## Commands

### Authentication

```bash
# Login
nova-verify auth login

# Logout
nova-verify auth logout

# Check auth status
nova-verify auth status
```

### Proof Management

```bash
# List all proofs
nova-verify proof list

# Create a new proof
nova-verify proof create
nova-verify proof create -f proof-data.json

# Get proof details
nova-verify proof get <proof-id>

# Delete a proof
nova-verify proof delete <proof-id>

# Batch operations
nova-verify proof batch operations.json
```

### Contract Deployment

```bash
# List deployed contracts
nova-verify deploy list

# Deploy a new contract
nova-verify deploy contract -n mainnet
nova-verify deploy contract -f contract-config.json

# Check deployment status
nova-verify deploy status <contract-id>

# Upgrade a contract
nova-verify deploy upgrade <contract-id> -f new-source.json
```

### Proof Verification

```bash
# Verify a specific proof
nova-verify verify proof <proof-id>
nova-verify verify proof <proof-id> -d  # detailed

# Batch verification
nova-verify verify batch proofs.json

# Check verification status
nova-verify verify status <verification-id>

# View verification history
nova-verify verify history <proof-id>

# Interactive verification
nova-verify verify interactive
```

## Configuration File Format

### Proof Data (proof-data.json)
```json
{
  "name": "My Proof",
  "description": "A sample proof",
  "data": {
    "field1": "value1",
    "field2": "value2"
  }
}
```

### Batch Operations (operations.json)
```json
{
  "operations": [
    {
      "type": "create",
      "data": {
        "name": "Proof 1",
        "description": "First proof"
      }
    },
    {
      "type": "update",
      "id": "proof-123",
      "data": {
        "status": "verified"
      }
    }
  ]
}
```

### Contract Config (contract-config.json)
```json
{
  "name": "MyContract",
  "source": "./contracts/MyContract.sol",
  "network": "mainnet",
  "parameters": {
    "param1": "value1"
  }
}
```

## Error Handling

The CLI provides user-friendly error messages and handles network issues gracefully. All commands include progress indicators for long-running operations.

## Cross-Platform Support

The CLI works on Windows, macOS, and Linux systems.

## Development

To build the CLI:

```bash
cd cli
npm run build
```

To run locally:

```bash
npm start
```

## License

MIT