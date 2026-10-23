import { IslandWorld } from '../world/IslandWorld';

export interface GridPoint {
  x: number;
  y: number;
}

interface AStarNode {
  x: number;
  y: number;
  g: number;
  f: number;
  parent?: AStarNode;
}

const DIRS = [
  { dx: 0, dy: -1, cost: 1 },
  { dx: 1, dy: 0, cost: 1 },
  { dx: 0, dy: 1, cost: 1 },
  { dx: -1, dy: 0, cost: 1 },
  { dx: 1, dy: -1, cost: 1.414 },
  { dx: 1, dy: 1, cost: 1.414 },
  { dx: -1, dy: 1, cost: 1.414 },
  { dx: -1, dy: -1, cost: 1.414 },
];

export function findPathAStar(
  world: IslandWorld,
  startX: number,
  startY: number,
  goalX: number,
  goalY: number
): GridPoint[] {
  if (startX === goalX && startY === goalY) return [];
  if (!world.isWalkable(goalX, goalY)) return [];

  const open: AStarNode[] = [];
  const closed = new Set<number>();
  const bestG = new Map<number, number>();
  const width = world.getConfig().mapWidth;

  const key = (x: number, y: number) => y * width + x;
  const heuristic = (x: number, y: number) => Math.hypot(goalX - x, goalY - y);

  const startNode: AStarNode = {
    x: startX,
    y: startY,
    g: 0,
    f: heuristic(startX, startY),
  };

  open.push(startNode);
  bestG.set(key(startX, startY), 0);

  let iterations = 0;
  const maxIterations = 2200;

  while (open.length > 0 && iterations++ < maxIterations) {
    // Pop node with lowest f
    let bestIdx = 0;
    for (let i = 1; i < open.length; i++) {
      if (open[i].f < open[bestIdx].f) {
        bestIdx = i;
      }
    }
    const current = open.splice(bestIdx, 1)[0];

    if (current.x === goalX && current.y === goalY) {
      const path: GridPoint[] = [];
      let curr: AStarNode | undefined = current;
      while (curr && !(curr.x === startX && curr.y === startY)) {
        path.push({ x: curr.x, y: curr.y });
        curr = curr.parent;
      }
      return path.reverse();
    }

    const currKey = key(current.x, current.y);
    closed.add(currKey);

    for (const dir of DIRS) {
      const nx = current.x + dir.dx;
      const ny = current.y + dir.dy;
      const nKey = key(nx, ny);

      if (closed.has(nKey)) continue;
      const tile = world.getTile(nx, ny);
      if (!tile || !tile.biome.walkable) continue;

      // Prevent diagonal corner-cutting across unwalkable water
      if (dir.dx !== 0 && dir.dy !== 0) {
        if (!world.isWalkable(current.x + dir.dx, current.y) || !world.isWalkable(current.x, current.y + dir.dy)) {
          continue;
        }
      }

      const terrainPenalty = 1 / Math.max(0.25, tile.biome.speedMultiplier);
      const tentativeG = current.g + dir.cost * terrainPenalty;

      const prevG = bestG.get(nKey);
      if (prevG === undefined || tentativeG < prevG) {
        bestG.set(nKey, tentativeG);
        open.push({
          x: nx,
          y: ny,
          g: tentativeG,
          f: tentativeG + heuristic(nx, ny),
          parent: current,
        });
      }
    }
  }

  return [];
}
