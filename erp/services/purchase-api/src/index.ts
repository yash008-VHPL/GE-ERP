import 'dotenv/config';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { config, allowedOrigins } from './config/env';
import { vendorsRouter }        from './routes/vendors';
import { itemsRouter }          from './routes/items';
import { purchaseOrdersRouter } from './routes/purchaseOrders';
import { itemReceiptsRouter }   from './routes/itemReceipts';
import { vendorBillsRouter }    from './routes/vendorBills';
import { paymentsRouter }       from './routes/payments';
import { clientsRouter }        from './routes/clients';
import { salesOrdersRouter }    from './routes/salesOrders';
import { fulfillmentsRouter }   from './routes/fulfillments';
import { invoicesRouter }       from './routes/invoices';
import { financialsRouter }     from './routes/financials';
import { inventoryLotsRouter }  from './routes/inventoryLots';
import { amendmentsRouter }     from './routes/amendments';

const app = express();

app.use(helmet());
app.use(express.json());
app.use(cors({ origin: allowedOrigins.length ? allowedOrigins : '*', credentials: true }));

app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'ge-erp-purchase-api' }));

app.use('/vendors',         vendorsRouter);
app.use('/items',           itemsRouter);
app.use('/purchase-orders', purchaseOrdersRouter);
app.use('/item-receipts',   itemReceiptsRouter);
app.use('/vendor-bills',    vendorBillsRouter);
app.use('/payments',        paymentsRouter);
app.use('/clients',         clientsRouter);
app.use('/sales-orders',    salesOrdersRouter);
app.use('/fulfillments',    fulfillmentsRouter);
app.use('/invoices',        invoicesRouter);
app.use('/financials',      financialsRouter);
app.use('/inventory-lots',  inventoryLotsRouter);
app.use('/amendments',      amendmentsRouter);

app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[error]', err.message);
  res.status(500).json({ error: err.message });
});

app.listen(config.PORT, () => {
  console.log(`[server] GE ERP Purchase API on port ${config.PORT}`);
});
