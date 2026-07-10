#!/usr/bin/env node
/**
 * Generate a Stellar testnet keypair for deploying ProofVerifier contracts.
 *
 * Usage: node scripts/generate-stellar-key.js
 *
 * After generating, add the secret key as a GitHub repository secret:
 *   1. Go to GitHub repo → Settings → Secrets and variables → Actions
 *   2. Click "New repository secret"
 *   3. Name: STELLAR_TESTNET_ADMIN_KEY
 *   4. Value: paste the Secret Key below
 */

const sdk = require('@stellar/stellar-sdk');

const keypair = sdk.Keypair.random();

console.log('');
console.log('══════════════════════════════════════════════');
console.log('  Stellar Testnet Keypair Generated');
console.log('══════════════════════════════════════════════');
console.log('');
console.log('  Public Key:  ' + keypair.publicKey());
console.log('  Secret Key:  ' + keypair.secret());
console.log('');
console.log('══════════════════════════════════════════════');
console.log('');
console.log('Next steps:');
console.log('  1. Copy the Secret Key above');
console.log('  2. Go to: GitHub repo → Settings → Secrets and variables → Actions');
console.log('  3. Click "New repository secret"');
console.log('  4. Name:  STELLAR_TESTNET_ADMIN_KEY');
console.log('  5. Value: paste the Secret Key');
console.log('  6. Click "Add secret"');
console.log('');
console.log('The workflow at .github/workflows/stellar-deploy.yml');
console.log('will use this key to deploy contracts to Stellar Testnet.');
console.log('');
