// Usage: swift grab.swift <video> <outDir> [count=12]
// Saves <count> evenly spaced JPEG stills from a clip (for reading outfits and looks). Stills stay local.
import AVFoundation
import CoreImage
import ImageIO
import UniformTypeIdentifiers

let args = CommandLine.arguments
let asset = AVURLAsset(url: URL(fileURLWithPath: args[1]))
let outDir = URL(fileURLWithPath: args[2])
let count = args.count > 3 ? Int(args[3])! : 12
try? FileManager.default.createDirectory(at: outDir, withIntermediateDirectories: true)
let gen = AVAssetImageGenerator(asset: asset)
gen.appliesPreferredTrackTransform = true
gen.requestedTimeToleranceBefore = .zero; gen.requestedTimeToleranceAfter = .zero
gen.maximumSize = CGSize(width: 960, height: 960)
let dur = CMTimeGetSeconds(asset.duration)
for k in 0..<count {
  let t = dur * (Double(k) + 0.5) / Double(count)
  guard let img = try? gen.copyCGImage(at: CMTime(seconds: t, preferredTimescale: 600), actualTime: nil) else { continue }
  let url = outDir.appendingPathComponent(String(format: "s%02d_t%06.2f.jpg", k, t))
  if let dst = CGImageDestinationCreateWithURL(url as CFURL, UTType.jpeg.identifier as CFString, 1, nil) {
    CGImageDestinationAddImage(dst, img, [kCGImageDestinationLossyCompressionQuality: 0.8] as CFDictionary); CGImageDestinationFinalize(dst)
  }
}
print("saved \(count) stills from \(args[1])")
