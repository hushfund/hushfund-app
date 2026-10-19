import { Noir } from '@noir-lang/noir_js'
import { UltraHonkBackend } from '@aztec/bb.js'
import { getBarretenberg } from './barretenberg.ts'
import { buildMerkleTree } from './merkleTree.ts'
import { bytesToHex } from './utils.ts'
import type { Note } from './note.ts'

/** withdraw.json proves note ownership for withdrawals and repayments, borrow.json for loans. */
type CircuitKind = 'withdraw' | 'borrow'
const CIRCUIT_URL: Record<CircuitKind, string> = { withdraw: '/circuits.json', borrow: '/borrow_circuits.json' }
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const cache: Partial<Record<CircuitKind, any>> = {}

async function loadCircuit(kind: CircuitKind) {
  if (!cache[kind]) cache[kind] = await (await fetch(CIRCUIT_URL[kind])).json()
  return cache[kind]
}

export interface NoteHashes {
  commitment: `0x${string}` // leaf in the tree: Poseidon2(inner, yieldIndex)
  nullifierHash: `0x${string}`
  collateralNullifierHash: `0x${string}`
  yieldIndex: bigint
}

export async function noteHashes(note: Note): Promise<NoteHashes> {
  const bb = await getBarretenberg()
  const one = new Uint8Array(32)
  one[31] = 1
  const [{ hash: commitment }, { hash: nh }, { hash: ch }] = await Promise.all([
    bb.poseidon2Hash({ inputs: [note.commitment, note.yieldIndex] }),
    bb.poseidon2Hash({ inputs: [note.nullifier] }),
    bb.poseidon2Hash({ inputs: [note.nullifier, one] }),
  ])
  return {
    commitment: bytesToHex(commitment) as `0x${string}`,
    nullifierHash: bytesToHex(nh) as `0x${string}`,
    collateralNullifierHash: bytesToHex(ch) as `0x${string}`,
    yieldIndex: BigInt(bytesToHex(note.yieldIndex)),
  }
}

export interface SpendProof extends NoteHashes {
  proof: `0x${string}`
  root: `0x${string}`
}

/**
 * Generates an UltraHonk proof in the browser. `extDataHash` comes from the vault contract
 * (withdrawExtDataHash / borrowExtDataHash / repayExtDataHash) so recipient, relayer, fee and amount are bound.
 */
export async function generateProof(
  kind: CircuitKind,
  note: Note,
  leaves: string[],
  extDataHash: `0x${string}`,
  onStage?: (stage: 'tree' | 'proof') => void,
): Promise<SpendProof> {
  const hashes = await noteHashes(note)
  onStage?.('tree')
  const tree = await buildMerkleTree(leaves)
  const index = tree.getIndex(hashes.commitment.toLowerCase())
  if (index < 0) throw new Error('Commitment not found in this vault')
  const mp = tree.proof(index)

  onStage?.('proof')
  const circuit = await loadCircuit(kind)
  const bb = await getBarretenberg()
  const input: Record<string, unknown> = {
    root: mp.root,
    collateral_nullifier_hash: hashes.collateralNullifierHash,
    ext_data_hash: extDataHash,
    yield_index: bytesToHex(note.yieldIndex),
    nullifier: bytesToHex(note.nullifier),
    secret: bytesToHex(note.secret),
    merkle_proof: mp.pathElements,
    is_even: mp.pathIndices.map((i) => i % 2 === 0),
  }
  if (kind === 'withdraw') input.nullifier_hash = hashes.nullifierHash

  const { witness } = await new Noir(circuit).execute(input as never)
  const { proof } = await new UltraHonkBackend(circuit.bytecode, bb).generateProof(witness, { verifierTarget: 'evm' })
  return { ...hashes, proof: bytesToHex(proof) as `0x${string}`, root: mp.root as `0x${string}` }
}
