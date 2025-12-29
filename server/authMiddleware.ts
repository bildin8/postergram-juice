import { Request, Response, NextFunction } from "express";

export const requirePartnerAuth = (req: Request, res: Response, next: NextFunction) => {
    const appPin = process.env.APP_PIN || "1234";
    const authHeader = req.headers["x-app-pin"];

    if (authHeader === appPin) {
        return next();
    }

    // Also check for a "superuser" bypass if needed (future proofing)
    // For now, strict PIN check
    return res.status(401).json({ message: "Unauthorized: Invalid or missing PIN" });
};

export const requireStoreAuth = (req: Request, res: Response, next: NextFunction) => {
    // For Store, we might want a different PIN or just the same one for now
    // Given "Single Business Owner", likely the same circles of trust, but let's be lenient for Store/Shop currently
    // as they might just be on a dedicated device.
    // BUT, to be "Management Engine", we strictly protect Partner.
    // We'll leave Store/Shop open-ish or use a simpler check if requested.
    // User asked for "Management Engine" for owner.
    return next();
};

export const requireShopAuth = (req: Request, res: Response, next: NextFunction) => {
    return next();
};
