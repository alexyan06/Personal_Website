import { ambient } from './ambient.mjs';
import { deeplinks } from './deeplinks.mjs';
import { gate } from './gate.mjs';
import { keyboard } from './keyboard.mjs';
import { list } from './list.mjs';
import { motion } from './motion.mjs';
import { rooms } from './rooms.mjs';
import { title } from './title.mjs';
import { world } from './world.mjs';

export const FLOW_RUNNERS = { title, world, rooms, deeplinks, keyboard, list, gate, motion, ambient };

/** The most time one flow may take before the walk moves on (ms). */
export const FLOW_BUDGET = { title: 90_000, world: 120_000, rooms: 480_000, deeplinks: 300_000, keyboard: 180_000, list: 60_000, gate: 90_000, motion: 120_000, ambient: 240_000 };
