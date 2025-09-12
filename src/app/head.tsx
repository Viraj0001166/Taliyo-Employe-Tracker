export default function Head() {
  return (
    <>
      {/* Preconnect to Firebase endpoints for faster auth/DB/storage handshakes */}
      <link rel="preconnect" href="https://firestore.googleapis.com" crossOrigin="" />
      <link rel="preconnect" href="https://www.googleapis.com" crossOrigin="" />
      <link rel="preconnect" href="https://www.gstatic.com" crossOrigin="" />
      <link rel="preconnect" href="https://securetoken.googleapis.com" crossOrigin="" />
      <link rel="preconnect" href="https://firebasestorage.googleapis.com" crossOrigin="" />
    </>
  );
}
