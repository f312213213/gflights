class Gflights < Formula
  desc "Search Google Flights from the terminal"
  homepage "https://github.com/f312213213/gflights"
  url "https://registry.npmjs.org/gflights/-/gflights-0.3.1.tgz"
  sha256 "c3170857c54eb1515a8460746a2d93f4c7901f0e3abed1cdd9879b1656c5e8e8"
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
