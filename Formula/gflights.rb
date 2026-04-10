class Gflights < Formula
  desc "Search Google Flights from the terminal"
  homepage "https://github.com/f312213213/gflights"
  url "https://registry.npmjs.org/gflights/-/gflights-0.4.0.tgz"
  sha256 "48e38c24378d953e70daf2c47a4a283a2cf1d25ac234aab4435bffa61f7d31db"
  license "MIT"

  depends_on "node"

  def install
    system "npm", "install", *std_npm_args
    bin.install_symlink libexec.glob("bin/*")
  end

  test do
    assert_match "Usage:", shell_output("#{bin}/gflights --help")
  end
end
