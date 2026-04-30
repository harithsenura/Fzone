import { API_BASE_URL } from '../config/api';

export const uploadToCloudinary = async (imageUri: string) => {
  try {
    if (imageUri.startsWith('http')) {
        return imageUri;
    }

    const signatureResponse = await fetch(`${API_BASE_URL}/api/cloudinary/signature`);
    if (!signatureResponse.ok) throw new Error('Failed to get Cloudinary signature');
    
    const { signature, timestamp, cloudName, apiKey } = await signatureResponse.json();

    const formData = new FormData();
    const filename = imageUri.split('/').pop() || 'upload.jpg';
    const match = /\.(\w+)$/.exec(filename);
    const type = match ? `image/${match[1]}` : `image/jpeg`;

    formData.append('file', {
      uri: imageUri,
      name: filename,
      type,
    } as any);
    formData.append('api_key', apiKey);
    formData.append('timestamp', timestamp.toString());
    formData.append('signature', signature);

    const uploadResponse = await fetch(
      `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
      {
        method: 'POST',
        body: formData,
      }
    );

    if (!uploadResponse.ok) {
      const errorData = await uploadResponse.json();
      console.error('Cloudinary Upload Error Details:', errorData);
      throw new Error('Failed to upload image to Cloudinary');
    }

    const data = await uploadResponse.json();
    
    const urlParts = data.secure_url.split('/upload/');
    if (urlParts.length === 2) {
      return `${urlParts[0]}/upload/f_auto,q_auto,w_1000/${urlParts[1]}`;
    }
    
    return data.secure_url;
  } catch (error) {
    console.error('Cloudinary Upload Error:', error);
    throw error;
  }
};
