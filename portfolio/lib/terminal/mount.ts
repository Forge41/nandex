import { BOOT_LOG, MOUNT_TREE, type MountNode } from "./constants";

export type TreeNode = { id: number; n: string; depth: number; parent: number | null; x: number; isDir: boolean };
export type TreeOp = { line: number; id: number; kind: "open" | "for" | "rec" | "ready" };
export type MountTree = { nodes: TreeNode[]; edges: [number, number][]; ops: TreeOp[]; leaves: number; maxD: number };

export const MOUNT_DURATION = 4200;

/** Lays leaves out left to right and centres each directory over its children,
 * recording the recursive mount's operations for the trace replay. */
export function buildTree(root: MountNode = MOUNT_TREE): MountTree {
  const nodes: TreeNode[] = [];
  const edges: [number, number][] = [];
  const ops: TreeOp[] = [];
  let leaf = 0;
  const walk = (t: MountNode, depth: number, parent: number | null): number => {
    const id = nodes.length;
    const node: TreeNode = { id, n: t.n, depth, parent, x: 0, isDir: !!t.c };
    nodes.push(node);
    if (parent != null) edges.push([parent, id]);
    ops.push({ line: 1, id, kind: "open" });
    if (t.c) {
      ops.push({ line: 2, id, kind: "for" });
      const kids = t.c.map((ch) => {
        ops.push({ line: 3, id, kind: "rec" });
        return walk(ch, depth + 1, id);
      });
      node.x = (nodes[kids[0]].x + nodes[kids[kids.length - 1]].x) / 2;
    } else node.x = leaf++;
    ops.push({ line: 4, id, kind: "ready" });
    return id;
  };
  walk(root, 0, null);
  return { nodes, edges, ops, leaves: leaf, maxD: Math.max(...nodes.map((n) => n.depth)) };
}

export type MountFrame = {
  opened: Set<number>;
  ready: Set<number>;
  cur: TreeOp | null;
  allReady: boolean;
  traceLine: number;
  logCount: number;
  status: string;
  board: { t: string; tone: "sub" | "muted" | "green" | "accent" }[];
};

export function mountFrame(tree: MountTree, el: number, dur = MOUNT_DURATION): MountFrame {
  const idx = Math.min(tree.ops.length - 1, Math.floor((el / dur) * tree.ops.length));
  const opened = new Set<number>();
  const ready = new Set<number>();
  let cur: TreeOp | null = null;
  for (let i = 0; i <= idx; i++) {
    const o = tree.ops[i];
    if (o.kind === "open") opened.add(o.id);
    if (o.kind === "ready") ready.add(o.id);
    cur = o;
  }
  const total = tree.nodes.length;
  const allReady = ready.size === total;
  const curName = cur ? tree.nodes[cur.id].n : "~/nandisha";
  return {
    opened,
    ready,
    cur,
    allReady,
    traceLine: allReady ? 6 : cur ? cur.line : 0,
    logCount: Math.min(BOOT_LOG.length, Math.floor((el / (dur + 500)) * BOOT_LOG.length) + (allReady ? 1 : 0)),
    status: allReady ? `all ${total} nodes ready — handing off to the terminal…` : `mounting ${curName}…`,
    board: [
      { t: `opened ${opened.size}/${total}`, tone: "sub" },
      { t: `ready ${ready.size}/${total}`, tone: allReady ? "green" : "muted" },
      { t: `depth ${tree.maxD}`, tone: "muted" },
      { t: cur ? `${cur.kind} ${curName}` : "", tone: "accent" },
    ],
  };
}
