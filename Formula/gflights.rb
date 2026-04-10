class Gflights < Formula
  desc "Search Google Flights from the terminal"
  homepage "https://github.com/f312213213/gflights"
  url "https://registry.npmjs.org/gflights/-/gflights-0.2.0.tgz"
  sha256 "2b89dedb3e419a26a7ca8aa170b49f2d51594f4d20e8ccc2a21a92363c217743"
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
