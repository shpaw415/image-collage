export const createImage = (url: string) =>
	new Promise<HTMLImageElement>((resolve, reject) => {
		const image = new Image();
		image.addEventListener("load", () => resolve(image));
		image.addEventListener("error", (error) => reject(error));
		image.setAttribute("crossOrigin", "anonymous");
		image.src = url;
	});

export function getRadianAngle(degreeValue: number) {
	return (degreeValue * Math.PI) / 180;
}

export function rotateSize(width: number, height: number, rotation: number) {
	const rotRad = getRadianAngle(rotation);

	return {
		width:
			Math.abs(Math.cos(rotRad) * width) + Math.abs(Math.sin(rotRad) * height),
		height:
			Math.abs(Math.sin(rotRad) * width) + Math.abs(Math.cos(rotRad) * height),
	};
}

export default async function getCroppedImg(
	imageSrc: string,
	pixelCrop: { x: number; y: number; width: number; height: number },
	rotation = 0,
): Promise<string | null> {
	const image = await createImage(imageSrc);
	const canvas = document.createElement("canvas");
	const ctx = canvas.getContext("2d");

	if (!ctx) {
		return null;
	}

	const rotRad = getRadianAngle(rotation);
	const bBox = rotateSize(image.width, image.height, rotation);

	canvas.width = bBox.width;
	canvas.height = bBox.height;

	ctx.translate(bBox.width / 2, bBox.height / 2);
	ctx.rotate(rotRad);
	ctx.translate(-image.width / 2, -image.height / 2);

	ctx.drawImage(image, 0, 0);

	const croppedCanvas = document.createElement("canvas");
	const croppedCtx = croppedCanvas.getContext("2d");

	if (!croppedCtx) {
		return null;
	}

	croppedCanvas.width = pixelCrop.width;
	croppedCanvas.height = pixelCrop.height;

	croppedCtx.drawImage(
		canvas,
		pixelCrop.x,
		pixelCrop.y,
		pixelCrop.width,
		pixelCrop.height,
		0,
		0,
		pixelCrop.width,
		pixelCrop.height,
	);

	return croppedCanvas.toDataURL("image/jpeg");
}
