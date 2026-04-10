class Gflights < Formula
  desc "Search Google Flights from the terminal"
  homepage "https://github.com/f312213213/gflights"
  version "0.1.0"
  license "MIT"

  on_macos do
    on_arm do
      url "https://github.com/f312213213/gflights/releases/download/v#{version}/gflights-darwin-arm64.tar.gz"
      sha256 "cfa7cf2e38c42c73147ea7603e42b1ad55d00df9ae2e2d56c870a8c292f20073"

      def install
        bin.install "gflights-darwin-arm64" => "gflights"
      end
    end

    on_intel do
      url "https://github.com/f312213213/gflights/releases/download/v#{version}/gflights-darwin-x64.tar.gz"
      sha256 "395a6866c6d09a2aa6a093ba4bc2399f81e5342e944a5399a6389d05336a0e3b"

      def install
        bin.install "gflights-darwin-x64" => "gflights"
      end
    end
  end

  on_linux do
    on_intel do
      url "https://github.com/f312213213/gflights/releases/download/v#{version}/gflights-linux-x64.tar.gz"
      sha256 "49c20dcebf9d37f32035d38b3cd080b95171e3346174ecf1105e3460c7b62e38"

      def install
        bin.install "gflights-linux-x64" => "gflights"
      end
    end
  end

  test do
    assert_match "Usage:", shell_output("#{bin}/gflights --help")
  end
end
