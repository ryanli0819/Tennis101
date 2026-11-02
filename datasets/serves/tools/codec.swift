// Usage: swift codec.swift <video>   — prints the video codec and whether macOS can decode it (AV1 often can't be on M1/M2).
import AVFoundation
let a = AVURLAsset(url: URL(fileURLWithPath: CommandLine.arguments[1]))
for t in a.tracks(withMediaType: .video) {
  let d = t.formatDescriptions.first as! CMFormatDescription
  let c = CMFormatDescriptionGetMediaSubType(d)
  let s = String([24,16,8,0].map { Character(UnicodeScalar(UInt8((c >> $0) & 255))) })
  print("codec", s, t.naturalSize, t.nominalFrameRate, "decodable", t.isDecodable, "playable", a.isPlayable)
}
