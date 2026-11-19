import { ImageResponse } from 'next/og';

export const size = { width: 32, height: 32 };
export const contentType = 'image/png';

export default function Icon() {
	return new ImageResponse(
		(
			<div
				style={{
					width: '100%',
					height: '100%',
					display: 'flex',
					alignItems: 'center',
					justifyContent: 'center',
					backgroundColor: '#10b981',
					border: '2px solid #047857',
					borderBottom: '4px solid #047857',
					borderRadius: '8px',
					color: '#ffffff',
					fontSize: 20,
					fontWeight: 900,
					fontFamily: 'sans-serif'
				}}
			>
				F
			</div>
		),
		{ ...size }
	);
}