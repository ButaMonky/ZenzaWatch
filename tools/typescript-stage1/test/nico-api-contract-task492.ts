// Task492: classify an uncertain comment POST outcome without assuming retry is safe.
import {CommentPostWire} from '../nico-src/CommentPostWire';

declare const rejection: unknown;
const result = CommentPostWire.classifyPostFailure(rejection, false);
const action: 'unknown' | 'rejected' | 'retry-token' = result.action;
const statusCode: unknown = result.statusCode;
const errorCode: unknown = result.errorCode;
void action; void statusCode; void errorCode;
// @ts-expect-error a retry decision cannot be assumed to always be retry-token
const retry: 'retry-token' = result.action;
void retry;
// @ts-expect-error the retrying flag is mandatory
void CommentPostWire.classifyPostFailure(rejection);
// @ts-expect-error the retrying flag must be boolean
void CommentPostWire.classifyPostFailure(rejection, 'true');
