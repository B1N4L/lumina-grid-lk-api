import { Router, Request, Response } from 'express';
import swaggerUi from 'swagger-ui-express';
import YAML from 'yamljs';
import path from 'path';
import fs from 'fs';

const router = Router();

/**
 * Locate and load OpenAPI 3.0 specification from filesystem.
 * Supports running from source (`src/docs/openapi.yaml`) as well as
 * compiled/bundled distribution (`dist/docs/openapi.yaml` or project root).
 */
function getOpenApiSpecPath(): string {
  const candidates = [
    path.resolve(process.cwd(), 'src/docs/openapi.yaml'),
    path.resolve(process.cwd(), 'dist/docs/openapi.yaml'),
    path.resolve(process.cwd(), 'openapi.yaml'),
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }
  throw new Error('OpenAPI specification file (openapi.yaml) not found in expected locations');
}

const specPath = getOpenApiSpecPath();
const rawYaml = fs.readFileSync(specPath, 'utf8');
const openApiDoc = YAML.parse(rawYaml);

/**
 * Swagger UI configuration options with CDN fallbacks for serverless environments (Vercel)
 */
const swaggerOptions: swaggerUi.SwaggerOptions = {
  customCssUrl: 'https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/5.11.0/swagger-ui.min.css',
  customJs: [
    'https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/5.11.0/swagger-ui-bundle.min.js',
    'https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/5.11.0/swagger-ui-standalone-preset.min.js',
  ],
  customSiteTitle: 'Lumina Grid LK - API Documentation',
  customCss: '.swagger-ui .topbar { background-color: #0b192c; }',
};

// Raw OpenAPI JSON specification
router.get('/openapi.json', (_req: Request, res: Response) => {
  res.setHeader('Content-Type', 'application/json');
  res.status(200).json(openApiDoc);
});

// Raw OpenAPI YAML specification
router.get('/openapi.yaml', (_req: Request, res: Response) => {
  res.setHeader('Content-Type', 'text/yaml; charset=utf-8');
  res.status(200).send(rawYaml);
});

// Interactive Swagger UI documentation
router.use('/docs', swaggerUi.serve, swaggerUi.setup(openApiDoc, swaggerOptions));

export default router;
