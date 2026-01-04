import { Sequential, ModelWeights } from './model';

/**
 * Serialization utilities for models
 */
export const Serializer = {
  /** Save model weights to JSON string */
  toJSON(model: Sequential): string {
    return JSON.stringify(model.getWeights());
  },

  /** Load model weights from JSON */
  fromJSON(model: Sequential, json: string | ModelWeights): Sequential {
    const weights = typeof json === 'string' ? JSON.parse(json) : json;
    model.loadWeights(weights);
    return model;
  },

  /** Save to binary format (compressed JSON as Uint8Array) */
  toBinary(model: Sequential): Uint8Array {
    const weights = model.getWeights();
    const json = JSON.stringify(weights);
    const encoder = new TextEncoder();
    return encoder.encode(json);
  },

  /** Load from binary format */
  fromBinary(model: Sequential, buffer: ArrayBuffer | Uint8Array): Sequential {
    const decoder = new TextDecoder();
    const json = decoder.decode(buffer);
    return this.fromJSON(model, json);
  },

  /** Save weights to Float32 binary (more compact) */
  toFloat32Binary(model: Sequential): ArrayBuffer {
    const weights = model.getWeights();

    // Calculate total size
    let totalParams = 0;
    const layerMeta: Array<{ name: string; params: Array<{ key: string; length: number }> }> = [];

    for (const [layerName, layerWeights] of Object.entries(weights)) {
      const params: Array<{ key: string; length: number }> = [];
      for (const [key, data] of Object.entries(layerWeights)) {
        totalParams += data.length;
        params.push({ key, length: data.length });
      }
      layerMeta.push({ name: layerName, params });
    }

    // Create buffer: [header length (4 bytes)] [header JSON] [float32 data]
    const headerJSON = JSON.stringify(layerMeta);
    const headerBytes = new TextEncoder().encode(headerJSON);
    const headerLength = headerBytes.length;

    const buffer = new ArrayBuffer(4 + headerLength + totalParams * 4);
    const view = new DataView(buffer);

    // Write header length
    view.setUint32(0, headerLength, true);

    // Write header
    const uint8View = new Uint8Array(buffer);
    uint8View.set(headerBytes, 4);

    // Write float32 data
    const float32View = new Float32Array(buffer, 4 + headerLength);
    let offset = 0;

    for (const [, layerWeights] of Object.entries(weights)) {
      for (const [, data] of Object.entries(layerWeights)) {
        for (const val of data) {
          float32View[offset++] = val;
        }
      }
    }

    return buffer;
  },

  /** Load weights from Float32 binary */
  fromFloat32Binary(model: Sequential, buffer: ArrayBuffer): Sequential {
    const view = new DataView(buffer);
    const headerLength = view.getUint32(0, true);

    const headerBytes = new Uint8Array(buffer, 4, headerLength);
    const headerJSON = new TextDecoder().decode(headerBytes);
    const layerMeta = JSON.parse(headerJSON) as Array<{
      name: string;
      params: Array<{ key: string; length: number }>;
    }>;

    const float32View = new Float32Array(buffer, 4 + headerLength);

    const weights: ModelWeights = {};
    let offset = 0;

    for (const { name, params } of layerMeta) {
      weights[name] = {};
      for (const { key, length } of params) {
        weights[name][key] = Array.from(float32View.slice(offset, offset + length));
        offset += length;
      }
    }

    model.loadWeights(weights);
    return model;
  },
};
