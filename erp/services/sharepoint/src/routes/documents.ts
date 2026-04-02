// =============================================================================
// GE ERP — SharePoint Service
// src/routes/documents.ts
//
// POST /documents/upload
//   Upload and store a supporting document for an ERP doc_id.
//   Requires M365 Bearer token (delegated, OBO flow).
//
// GET  /documents/:docId
//   Fetch the active supporting document record for a given doc_id.
//
// GET  /documents/:docId/history
//   Fetch all uploads (including superseded) for a given doc_id.
// =============================================================================

import { Router, Request, Response, NextFunction } from 'express';
import { body, param, validationResult } from 'express-validator';
import { requireAuth }       from '../middleware/auth';
import { upload }            from '../middleware/upload';
import { httpError }         from '../middleware/errorHandler';
import * as documentService  from '../services/documentService';
import * as dbService        from '../services/dbService';
import { isValidDocId }      from '../utils/docIdParser';
import { SUPPORTING_DOC_LABEL } from '../types/document';

export const documentsRouter = Router();

// ---------------------------------------------------------------------------
// POST /documents/upload
// ---------------------------------------------------------------------------
documentsRouter.post(
  '/upload',

  // 1. Authenticate via M365 OBO
  requireAuth,

  // 2. Parse multipart form (file must be field name "file")
  upload.single('file'),

  // 3. Validate request body fields
  body('doc_id')
    .notEmpty().withMessage('doc_id is required')
    .custom((v: string) => {
      if (!isValidDocId(v)) throw new Error('doc_id must match GE-DDD-NNNN-YYYY format');
      return true;
    }),
  body('related_doc_id')
    .optional()
    .custom((v: string) => {
      if (v && !isValidDocId(v)) throw new Error('related_doc_id must match GE-DDD-NNNN-YYYY format');
      return true;
    }),

  // 4. Handler
  async (req: Request, res: Response, next: NextFunction) => {
    // Validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return next(httpError('Validation failed', 400, errors.array()));
    }

    // File must be present
    if (!req.file) {
      return next(httpError('No file uploaded — use field name "file"', 400));
    }

    try {
      const result = await documentService.orchestrateUpload({
        docId:          req.body.doc_id as string,
        relatedDocId:   req.body.related_doc_id as string | undefined,
        file:           req.file,
        uploadedByUpn:  req.userUpn,
        uploadedByName: req.userName,
        graphToken:     req.graphToken,
      });

      res.status(201).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }
);

// ---------------------------------------------------------------------------
// GET /documents/:docId  — active document
// ---------------------------------------------------------------------------
documentsRouter.get(
  '/:docId',
  requireAuth,
  param('docId').custom((v: string) => {
    if (!isValidDocId(v)) throw new Error('docId must match GE-DDD-NNNN-YYYY format');
    return true;
  }),
  async (req: Request, res: Response, next: NextFunction) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return next(httpError('Validation failed', 400, errors.array()));

    try {
      const doc = await dbService.getActiveDocument(req.params.docId);
      if (!doc) {
        return next(httpError(`No supporting document found for ${req.params.docId}`, 404));
      }
      res.json({ success: true, data: doc });
    } catch (err) {
      next(err);
    }
  }
);

// ---------------------------------------------------------------------------
// GET /documents/:docId/history  — full upload history
// ---------------------------------------------------------------------------
documentsRouter.get(
  '/:docId/history',
  requireAuth,
  param('docId').custom((v: string) => {
    if (!isValidDocId(v)) throw new Error('docId must match GE-DDD-NNNN-YYYY format');
    return true;
  }),
  async (req: Request, res: Response, next: NextFunction) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return next(httpError('Validation failed', 400, errors.array()));

    try {
      const history = await dbService.getAllDocuments(req.params.docId);
      res.json({ success: true, count: history.length, data: history });
    } catch (err) {
      next(err);
    }
  }
);

// ---------------------------------------------------------------------------
// GET /documents/meta/labels  — doc type → required supporting document labels
// ---------------------------------------------------------------------------
documentsRouter.get('/meta/labels', (_req: Request, res: Response) => {
  res.json({ success: true, data: SUPPORTING_DOC_LABEL });
});
