/**
 * Nova Verify ProofVerifier - Stellar Testnet Deployment Script
 * 
 * Usage: node deploy-testnet.js
 * 
 * Prerequisites:
 *   npm install @stellar/stellar-sdk
 * 
 * The WASM must be built first:
 *   cd contracts/deployable && cargo build --release --target wasm32-unknown-unknown
 */

const sdk = require('@stellar/stellar-sdk');
const { Keypair, Networks, SorobanRpc, TransactionBuilder, Operation, xdr } = sdk;
const fs = require('fs');
const crypto = require('crypto');

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

async function pollTx(server, txHash, label) {
  for (let i = 0; i < 40; i++) {
    await new Promise(r => setTimeout(r, 4000));
    try {
      const result = await server.getTransaction(txHash);
      console.log(`   ${label} [${i + 1}]: ${result.status}`);
      if (result.status === 'SUCCESS') return result;
      if (result.status === 'FAILED') throw new Error(`${label} FAILED`);
    } catch (e) {
      console.log(`   ${label} [${i + 1}]: retrying...`);
    }
  }
  throw new Error(`${label} timed out`);
}

async function deploy() {
  console.log('🚀 Deploying Nova Verify ProofVerifier to Stellar Testnet...\n');

  // 1. Generate keypair
  const keypair = Keypair.random();
  const publicKey = keypair.publicKey();
  const secretKey = keypair.secret();
  console.log(`🔑 Generated admin keypair:`);
  console.log(`   Public: ${publicKey}`);
  console.log(`   Secret: ${secretKey}\n`);

  // 2. RPC server
  const server = new SorobanRpc.Server('https://soroban-testnet.stellar.org');

  // 3. Fund via airdrop
  console.log('💰 Requesting testnet airdrop...');
  try {
    await server.requestAirdrop(publicKey);
    console.log('   ✅ Airdrop requested\n');
  } catch (err) {
    console.log(`   ⚠️ Airdrop: ${err.message}\n`);
  }

  await new Promise(r => setTimeout(r, 12000));
  
  try {
    const acct = await server.getAccount(publicKey);
    console.log(`   ✅ Account funded. Sequence: ${acct.sequenceNumber()}\n`);
  } catch (err) {
    throw new Error(`Account not funded: ${err.message}`);
  }

  // 4. Read WASM
  const wasmPath = 'contracts/deployable/target/wasm32-unknown-unknown/release/nova_verify_proof_verifier.wasm';
  console.log(`📦 Reading WASM: ${wasmPath}`);
  const wasmBuffer = fs.readFileSync(wasmPath);
  const wasmHash = crypto.createHash('sha256').update(wasmBuffer).digest();
  console.log(`   ✅ ${wasmBuffer.length} bytes`);
  console.log(`   📦 Hash: ${wasmHash.toString('hex')}\n`);

  // 5. Upload WASM
  console.log('📤 Uploading contract WASM...');
  
  const account = await server.getAccount(publicKey);
  
  const uploadOp = Operation.uploadContractWasm({ wasm: wasmBuffer });
  
  const uploadTx = new TransactionBuilder(account, {
    fee: '100000',
    networkPassphrase: Networks.TESTNET
  })
  .setTimeout(60)
  .addOperation(uploadOp)
  .build();

  const uploadSim = await server.simulateTransaction(uploadTx);
  if (uploadSim.error) throw new Error(`Upload sim failed: ${JSON.stringify(uploadSim.error)}`);
  console.log('   ✅ Upload simulation OK');

  const uploadPrepared = await server.prepareTransaction(uploadTx);
  uploadPrepared.sign(keypair);
  const uploadSend = await server.sendTransaction(uploadPrepared);
  console.log(`   📤 Upload tx: ${uploadSend.hash}`);

  const uploadResult = await pollTx(server, uploadSend.hash, 'Upload');
  console.log('   ✅ Upload confirmed!\n');

  // 6. Create contract instance
  console.log('🏗️ Creating contract instance...');
  await new Promise(r => setTimeout(r, 5000));
  
  const account2 = await server.getAccount(publicKey);
  const salt = Buffer.alloc(32, 0);
  
  // Try createCustomContract first (simpler API)
  const createOp = Operation.createCustomContract({
    address: publicKey,
    wasmHash: wasmHash,
    salt: salt
  });
  
  const createTx = new TransactionBuilder(account2, {
    fee: '100000',
    networkPassphrase: Networks.TESTNET
  })
  .setTimeout(60)
  .addOperation(createOp)
  .build();

  const createSim = await server.simulateTransaction(createTx);
  if (createSim.error) {
    console.log('   Sim error:', JSON.stringify(createSim.error).substring(0, 200));
    throw new Error('Create simulation failed');
  }
  console.log('   ✅ Create simulation OK');
  
  const createPrepared = await server.prepareTransaction(createTx);
  createPrepared.sign(keypair);
  const createSend = await server.sendTransaction(createPrepared);
  console.log(`   🏗️ Create tx: ${createSend.hash}`);

  const createResult = await pollTx(server, createSend.hash, 'Create');
  console.log('   ✅ Contract created!\n');

  // 7. Save deployment info
  const deployInfo = {
    network: 'testnet',
    adminPublicKey: publicKey,
    adminSecretKey: secretKey,
    uploadTx: uploadSend.hash,
    createTx: createSend.hash,
    wasmHash: wasmHash.toString('hex'),
    deployedAt: new Date().toISOString()
  };
  
  fs.writeFileSync('deploy-info.json', JSON.stringify(deployInfo, null, 2));
  
  console.log('🎉 DEPLOYMENT COMPLETE!');
  console.log('═══════════════════════════════════════');
  console.log(`📍 Network:   Stellar Testnet`);
  console.log(`👤 Admin:     ${publicKey}`);
  console.log(`🔐 Secret:    ${secretKey}`);
  console.log(`📦 WasmHash:  ${wasmHash.toString('hex')}`);
  console.log(`📤 UploadTx:  ${uploadSend.hash}`);
  console.log(`🏗️ CreateTx:  ${createSend.hash}`);
  console.log('═══════════════════════════════════════');
  console.log('\n⚠️  SAVE THE SECRET KEY!');
  console.log('📝 Deployment info saved to deploy-info.json');
}

deploy().catch(err => {
  console.error(`\n❌ Deployment failed: ${err.message}`);
  process.exit(1);
});
