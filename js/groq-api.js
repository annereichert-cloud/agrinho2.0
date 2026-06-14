(function () {
  const MAX_IMAGE_BYTES = 2_700_000;
  const MAX_IMAGE_DIMENSION = 1800;

  function canvasToBlob(canvas, quality) {
    return new Promise((resolve, reject) => {
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error('Não foi possível preparar a imagem.'))),
        'image/jpeg',
        quality
      );
    });
  }

  function blobToDataUrl(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error('Não foi possível ler a imagem.'));
      reader.readAsDataURL(blob);
    });
  }

  async function prepararImagem(imageFile) {
    const bitmap = await createImageBitmap(imageFile);
    const scale = Math.min(1, MAX_IMAGE_DIMENSION / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();

    let quality = 0.9;
    let blob = await canvasToBlob(canvas, quality);
    while (blob.size > MAX_IMAGE_BYTES && quality > 0.45) {
      quality -= 0.1;
      blob = await canvasToBlob(canvas, quality);
    }

    if (blob.size > MAX_IMAGE_BYTES) {
      throw new Error('A imagem continua muito grande para envio. Tire uma foto com resolução menor.');
    }

    return blobToDataUrl(blob);
  }

  async function lerLaudo(imageFile) {
    const imageDataUrl = await prepararImagem(imageFile);
    const response = await fetch('/api/groq/ler-laudo', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imageDataUrl })
    });
    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(payload.error || 'Não foi possível ler o laudo com a Groq.');
    }

    return payload;
  }

  window.groqApi = { lerLaudo };
})();
