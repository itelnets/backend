import { Request, Response, NextFunction } from 'express';

export const logger = (req: Request, res: Response, next: NextFunction) => {
    if (req.method === 'OPTIONS') {
        return next();
    }
    const start = Date.now();

    res.on('finish', () => {
        const duration = Date.now() - start;
        const formattedDate = new Date()
            .toISOString()
            .replace('T', ' ')
            .substring(0, 19);

        const greenTimestamp = `\x1b[32m[${formattedDate}]\x1b[0m`;

        console.log(
            `${greenTimestamp} ${req.method} ${req.originalUrl} - Status: ${res.statusCode} - ${duration}ms`
        );
    });

    next();
};