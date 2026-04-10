class Gflights < Formula
  desc "Search Google Flights from the terminal"
  homepage "https://github.com/f312213213/gflights"
  version "0.1.0"
  license "MIT"

  on_macos do
    on_arm do
      url "https://github.com/f312213213/gflights/releases/download/v#{version}/gflights-darwin-arm64.tar.gz"
      sha256 "PLACEHOLDER"

      def install
        bin.install "gflights-darwin-arm64" => "gflights"
      end
    end

    on_intel do
      url "https://github.com/f312213213/gflights/releases/download/v#{version}/gflights-darwin-x64.tar.gz"
      sha256 "PLACEHOLDER"

      def install
        bin.install "gflights-darwin-x64" => "gflights"
      end
    end
  end

  on_linux do
    on_intel do
      url "https://github.com/f312213213/gflights/releases/download/v#{version}/gflights-linux-x64.tar.gz"
      sha256 "PLACEHOLDER"

      def install
        bin.install "gflights-linux-x64" => "gflights"
      end
    end
  end

  test do
    assert_match "Usage:", shell_output("#{bin}/gflights --help")
  end
end
