import { model, models, type Model, type Schema } from 'mongoose';

/**
 * Defines a Mongoose model on the default connection.
 *
 * `mongoose.models` is checked first so the helper is idempotent: re-importing
 * a model file (which happens in test suites) will not throw
 * `OverwriteModelError`.
 */
export function defineModel<T>(name: string, schema: Schema<T>): Model<T> {
  const existing = models[name] as Model<T> | undefined;
  if (existing) return existing;

  schema.set('toJSON', {
    virtuals: true,
    versionKey: false,
    transform: (_document, returned: Record<string, unknown>) => {
      returned.id = String(returned._id);
      delete returned._id;
      return returned;
    },
  });

  return model<T>(name, schema);
}
