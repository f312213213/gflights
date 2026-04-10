class Gflights < Formula
  desc "Search Google Flights from the terminal"
  homepage "https://github.com/f312213213/gflights"
  version "0.1.0"
  license "MIT"

  on_macos do
    on_arm do
      url "https://github.com/f312213213/gflights/releases/download/v#{version}/gflights-darwin-arm64.tar.gz"
      sha256 "d24bf7fba71e6637758a3f92a229c7c34ac4b27a9d1ac966a4d53584b83eb2f2"

      def install
        bin.install "gflights-darwin-arm64" => "gflights"
      end
    end

    on_intel do
      url "https://github.com/f312213213/gflights/releases/download/v#{version}/gflights-darwin-x64.tar.gz"
      sha256 "54a778004df2ab6f1e2de646869f080969c55a5ffe541d460ef06e110a288ca9"

      def install
        bin.install "gflights-darwin-x64" => "gflights"
      end
    end
  end

  on_linux do
    on_intel do
      url "https://github.com/f312213213/gflights/releases/download/v#{version}/gflights-linux-x64.tar.gz"
      sha256 "84a5edc22a64ff800a2c07f292ad37e3674be912947664029562c9b0a10cb8fa"

      def install
        bin.install "gflights-linux-x64" => "gflights"
      end
    end
  end

  test do
    assert_match "Usage:", shell_output("#{bin}/gflights --help")
  end
end
