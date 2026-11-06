import fs from 'node:fs';
import path from 'node:path';

export class Store {
  constructor(file) {
    this.file = path.resolve(file);
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    if (!fs.existsSync(this.file)) this.write({ sessions: {}, scores: [] });
  }

  read() { return JSON.parse(fs.readFileSync(this.file, 'utf8')); }

  write(data) {
    const temp = `${this.file}.${process.pid}.tmp`;
    fs.writeFileSync(temp, JSON.stringify(data), { mode: 0o600 });
    fs.renameSync(temp, this.file);
  }

  createSession(id, seed, issuedAt) {
    const data = this.read();
    const cutoff = issuedAt - 31 * 60_000;
    for (const [key, value] of Object.entries(data.sessions)) {
      if (value.issuedAt < cutoff) delete data.sessions[key];
    }
    data.sessions[id] = { seed, issuedAt, used: false };
    this.write(data);
  }

  getSession(id) { return this.read().sessions[id]; }

  finishSession(id, score) {
    const data = this.read();
    if (!data.sessions[id] || data.sessions[id].used) return false;
    data.sessions[id].used = true;
    data.scores.push(score);
    // One process only. Keep recent sessions bounded; preserve unexpired sessions.
    const cutoff = Date.now() - 31 * 60_000;
    for (const [key, value] of Object.entries(data.sessions)) {
      if (value.issuedAt < cutoff) delete data.sessions[key];
    }
    this.write(data);
    return true;
  }

  leaderboard(limit = 10) {
    return this.read().scores
      .sort((a, b) => b.score - a.score || b.floors - a.floors || a.createdAt - b.createdAt)
      .slice(0, limit)
      .map(({ name, score, floors, perfects, createdAt }) => ({ name, score, floors, perfects, createdAt }));
  }
}

