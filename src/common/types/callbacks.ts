export type CallbackResponse<T = any> =
  | {
      success: true;
      data: T;
    }
  | {
      success: false;
      error: string;
    };
