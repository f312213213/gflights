class Gflights < Formula
  desc "Search Google Flights from the terminal"
  homepage "https://github.com/f312213213/gflights"
  version "0.1.0"
  license "MIT"

  on_macos do
    on_arm do
      url "https://github.com/f312213213/gflights/releases/download/v#{version}/gflights-darwin-arm64.tar.gz"
      sha256 "c7f6b760de982e9efae6760d8c2ce192d88a2e06c75cc9071c9c693f45824999"

      def install
        bin.install "gflights-darwin-arm64" => "gflights"
      end
    end

    on_intel do
      url "https://github.com/f312213213/gflights/releases/download/v#{version}/gflights-darwin-x64.tar.gz"
      sha256 "3847b7da169ed3391b1750a8509c23a8e552763daff773b0f4c141441c926ec2"

      def install
        bin.install "gflights-darwin-x64" => "gflights"
      end
    end
  end

  on_linux do
    on_intel do
      url "https://github.com/f312213213/gflights/releases/download/v#{version}/gflights-linux-x64.tar.gz"
      sha256 "8678c61f1c4c4ab2f8b960eabfa972170afbd68c9029e1831addae7a036420c7"

      def install
        bin.install "gflights-linux-x64" => "gflights"
      end
    end
  end

  test do
    assert_match "Usage:", shell_output("#{bin}/gflights --help")
  end
end
