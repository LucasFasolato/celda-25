export default function Home() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-6 p-6 text-center">
      <div className="stamp px-4 py-1 text-sm font-bold">CONFIDENCIAL</div>
      <h1 className="text-4xl font-bold tracking-widest text-cell-amber">CELDA 25</h1>
      <p className="text-lg tracking-[0.35em] text-cell-muted">CÁRCEL DEL QUINCHO</p>
      <p className="max-w-sm text-sm text-cell-muted">
        Terminal penitenciaria. El acceso a las celdas se realiza únicamente mediante código QR
        autorizado.
      </p>
    </main>
  );
}
