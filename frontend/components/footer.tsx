import Link from "next/link";

export function Footer() {
  return (
    <footer className="relative z-10 border-t border-cyan-400/10 bg-black/80 backdrop-blur-md mt-20">
      <div className="max-w-7xl mx-auto px-8 py-16">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-12 mb-12">
          <div className="col-span-1">
            <Link href="/" className="flex items-center gap-3 mb-6">
              <img
                src="/iso-logo.svg"
                alt="Lunarys Logo"
                className="w-10 h-10 animate-spin-slow"
              />
              <span className="text-2xl font-bold tracking-tight text-white">
                LUNARYS
              </span>
            </Link>
            <p className="text-gray-400 text-sm leading-relaxed">
              The next generation of encrypted cross-chain bridging powered by
              zero-knowledge technology.
            </p>
          </div>

          <div>
            <h4 className="text-white font-bold mb-4 text-lg">Product</h4>
            <ul className="space-y-3">
              <li>
                <Link
                  href="/bridge"
                  className="text-gray-400 hover:text-cyan-400 transition-colors text-sm"
                >
                  Bridge
                </Link>
              </li>
              <li>
                <Link
                  href="#"
                  className="text-gray-400 hover:text-cyan-400 transition-colors text-sm"
                >
                  Analytics
                </Link>
              </li>
              <li>
                <Link
                  href="#"
                  className="text-gray-400 hover:text-cyan-400 transition-colors text-sm"
                >
                  Security
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="text-white font-bold mb-4 text-lg">Resources</h4>
            <ul className="space-y-3">
              <li>
                <Link
                  href="/#docs"
                  className="text-gray-400 hover:text-cyan-400 transition-colors text-sm"
                >
                  Documentation
                </Link>
              </li>
              <li>
                <Link
                  href="#"
                  className="text-gray-400 hover:text-cyan-400 transition-colors text-sm"
                >
                  Blog
                </Link>
              </li>
              <li>
                <Link
                  href="#"
                  className="text-gray-400 hover:text-cyan-400 transition-colors text-sm"
                >
                  API Reference
                </Link>
              </li>
              <li>
                <Link
                  href="#"
                  className="text-gray-400 hover:text-cyan-400 transition-colors text-sm"
                >
                  FAQ
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="text-white font-bold mb-4 text-lg">Company</h4>
            <ul className="space-y-3">
              <li>
                <Link
                  href="#"
                  className="text-gray-400 hover:text-cyan-400 transition-colors text-sm"
                >
                  About
                </Link>
              </li>
              <li>
                <Link
                  href="#"
                  className="text-gray-400 hover:text-cyan-400 transition-colors text-sm"
                >
                  Careers
                </Link>
              </li>
              <li>
                <Link
                  href="#"
                  className="text-gray-400 hover:text-cyan-400 transition-colors text-sm"
                >
                  Contact
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="text-white font-bold mb-4 text-lg">Community</h4>
            <ul className="space-y-3">
              <li>
                <Link
                  href="#"
                  className="text-gray-400 hover:text-cyan-400 transition-colors text-sm"
                >
                  Twitter
                </Link>
              </li>
              <li>
                <Link
                  href="#"
                  className="text-gray-400 hover:text-cyan-400 transition-colors text-sm"
                >
                  GitHub
                </Link>
              </li>
              <li>
                <Link
                  href="#"
                  className="text-gray-400 hover:text-cyan-400 transition-colors text-sm"
                >
                  Telegram
                </Link>
              </li>
              <li>
                <Link
                  href="#"
                  className="text-gray-400 hover:text-cyan-400 transition-colors text-sm"
                >
                  Discord
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-cyan-400/10 pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-gray-500 text-sm">
            © 2025 Lunarys. All rights reserved.
          </p>
          <div className="flex gap-8">
            <Link
              href="#"
              className="text-gray-500 hover:text-cyan-400 transition-colors text-sm"
            >
              Privacy Policy
            </Link>
            <Link
              href="/terms"
              className="text-gray-500 hover:text-cyan-400 transition-colors text-sm"
            >
              Terms of Service
            </Link>
            <Link
              href="#"
              className="text-gray-500 hover:text-cyan-400 transition-colors text-sm"
            >
              Cookie Policy
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
