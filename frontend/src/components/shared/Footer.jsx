export default function Footer() {
  return (
    <footer className="border-t border-[var(--borde)] py-4 px-6 text-center text-xs text-[var(--suave)]">
      FinanzasQ · {new Date().getFullYear()}
    </footer>
  );
}
