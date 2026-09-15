// src/index.ts
import express, { Request, Response } from 'express';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

// Middleware to parse JSON request bodies
app.use(express.json());

// Health check endpoint
app.get('/api/health', (req: Request, res: Response) => {
  res.status(200).json({ status: 'Operational', service: 'SolarSummit API' });
});

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});