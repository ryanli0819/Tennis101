// Usage: swift pose.swift <video> <out.json> <framesDir> [sheetEverySec]
// Runs Apple Vision 2D body pose on every frame; writes JSON and periodic JPEG stills.
import AVFoundation
import Vision
import CoreImage
import ImageIO
import UniformTypeIdentifiers

let args = CommandLine.arguments
let url = URL(fileURLWithPath: args[1])
let outURL = URL(fileURLWithPath: args[2])
let framesDir = URL(fileURLWithPath: args[3])
let sheetEvery = args.count > 4 ? Double(args[4])! : 0.5
try? FileManager.default.createDirectory(at: framesDir, withIntermediateDirectories: true)

let asset = AVURLAsset(url: url)
let track = asset.tracks(withMediaType: .video).first!
let size = track.naturalSize.applying(track.preferredTransform)
let fps = track.nominalFrameRate
let reader = try AVAssetReader(asset: asset)
let output = AVAssetReaderTrackOutput(track: track, outputSettings: [kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32BGRA])
reader.add(output)
reader.startReading()

let names: [(String, VNHumanBodyPoseObservation.JointName)] = [
  ("nose", .nose), ("leftEye", .leftEye), ("rightEye", .rightEye), ("leftEar", .leftEar), ("rightEar", .rightEar),
  ("neck", .neck), ("leftShoulder", .leftShoulder), ("rightShoulder", .rightShoulder),
  ("leftElbow", .leftElbow), ("rightElbow", .rightElbow), ("leftWrist", .leftWrist), ("rightWrist", .rightWrist),
  ("root", .root), ("leftHip", .leftHip), ("rightHip", .rightHip),
  ("leftKnee", .leftKnee), ("rightKnee", .rightKnee), ("leftAnkle", .leftAnkle), ("rightAnkle", .rightAnkle)]

let ctx = CIContext()
var frames: [[String: Any]] = []
var nextSheet = 0.0
var idx = 0
while let sample = output.copyNextSampleBuffer() {
  guard let pb = CMSampleBufferGetImageBuffer(sample) else { continue }
  let t = CMSampleBufferGetPresentationTimeStamp(sample).seconds
  let req = VNDetectHumanBodyPoseRequest()
  let handler = VNImageRequestHandler(cvPixelBuffer: pb, orientation: .up)
  try? handler.perform([req])
  var people: [[String: Any]] = []
  for obs in req.results ?? [] {
    var joints: [String: [Double]] = [:]
    for (n, j) in names {
      if let p = try? obs.recognizedPoint(j), p.confidence > 0.1 {
        joints[n] = [round(Double(p.location.x) * 10000) / 10000, round((1 - Double(p.location.y)) * 10000) / 10000, round(Double(p.confidence) * 100) / 100]
      }
    }
    if !joints.isEmpty { people.append(["joints": joints, "confidence": Double(obs.confidence)]) }
  }
  frames.append(["i": idx, "t": round(t * 1000) / 1000, "people": people])
  if t >= nextSheet {
    let img = CIImage(cvPixelBuffer: pb)
    let scale = 640.0 / Double(CVPixelBufferGetWidth(pb))
    let small = img.transformed(by: CGAffineTransform(scaleX: scale, y: scale))
    if let cg = ctx.createCGImage(small, from: small.extent) {
      let f = framesDir.appendingPathComponent(String(format: "f%04d_t%06.2f.jpg", idx, t))
      if let dest = CGImageDestinationCreateWithURL(f as CFURL, UTType.jpeg.identifier as CFString, 1, nil) {
        CGImageDestinationAddImage(dest, cg, [kCGImageDestinationLossyCompressionQuality: 0.7] as CFDictionary)
        CGImageDestinationFinalize(dest)
      }
    }
    nextSheet += sheetEvery
  }
  idx += 1
}
let json: [String: Any] = ["source": url.lastPathComponent, "width": abs(size.width), "height": abs(size.height), "fps": fps,
  "coords": "x,y normalized 0..1 from top-left of the video frame; third value = confidence",
  "frames": frames]
let data = try JSONSerialization.data(withJSONObject: json, options: [.sortedKeys])
try data.write(to: outURL)
let withPeople = frames.filter { ($0["people"] as! [Any]).count > 0 }.count
print("\(url.lastPathComponent): \(idx) frames @ \(fps) fps, \(Int(abs(size.width)))x\(Int(abs(size.height))), frames with a person: \(withPeople)")
