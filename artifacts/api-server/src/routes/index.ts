import { Router, type IRouter } from "express";
import healthRouter from "./health";
import emailsRouter from "./emails";
import digestRouter from "./digest";
import cronRouter from "./cron";
import inboundRouter from "./inbound";
import devRouter from "./dev";

const router: IRouter = Router();

router.use(healthRouter);
router.use(emailsRouter);
router.use(digestRouter);
router.use(cronRouter);
router.use(inboundRouter);

// Dev routes — only mount in non-production environments
if (process.env.NODE_ENV !== "production") {
  router.use(devRouter);
}

export default router;
