import { getPaginated, http, postOne } from './apiClient';
import type { MediaAsset, SuccessEnvelopeLike } from '../types/api';

/** Media endpoints. Upload is multipart, so it bypasses the JSON defaults. */
export const mediaApi = {
  list: (page = 1, pageSize = 20) => getPaginated<MediaAsset>('/media', { page, pageSize }),

  upload: async (file: File): Promise<MediaAsset> => {
    const form = new FormData();
    form.append('file', file);

    const response = await http.post<SuccessEnvelopeLike<MediaAsset>>('/media/upload', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data.data;
  },

  promote: (id: string) => postOne<MediaAsset>(`/media/${id}/promote`),
};
