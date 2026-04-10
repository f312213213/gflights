class Gflights < Formula
  desc "Search Google Flights from the terminal"
  homepage "https://github.com/f312213213/gflights"
  url "https://registry.npmjs.org/gflights/-/gflights-0.3.0.tgz"
  sha256 "6c0432d771c1a97d209d4a45e79e678fef31ff37828729a4d50bc1760fb7587a"
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
