// Usage: swift track_labels.swift <video> <out.json> [full]
// Per frame: Apple Vision text in the bottom-left label (frame, t, knee angles; "full" reads the whole picture,
// for the 3D knee labels) and Apple Vision 2D body pose. Writes JSON only; no frames are saved.
import AVFoundation
import Vision
let args = CommandLine.arguments
let asset = AVURLAsset(url: URL(fileURLWithPath: args[1]))
let track = asset.tracks(withMediaType: .video).first!
let size = track.naturalSize
let reader = try! AVAssetReader(asset: asset)
let output = AVAssetReaderTrackOutput(track: track, outputSettings: [kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32BGRA])
reader.add(output); reader.startReading()
let names: [(String, VNHumanBodyPoseObservation.JointName)] = [
  ("nose", .nose), ("neck", .neck), ("leftShoulder", .leftShoulder), ("rightShoulder", .rightShoulder),
  ("leftElbow", .leftElbow), ("rightElbow", .rightElbow), ("leftWrist", .leftWrist), ("rightWrist", .rightWrist),
  ("root", .root), ("leftHip", .leftHip), ("rightHip", .rightHip),
  ("leftKnee", .leftKnee), ("rightKnee", .rightKnee), ("leftAnkle", .leftAnkle), ("rightAnkle", .rightAnkle)]
var frames: [[String: Any]] = []
while let sample = output.copyNextSampleBuffer() {
  guard let pb = CMSampleBufferGetImageBuffer(sample) else { continue }
  let t = CMSampleBufferGetPresentationTimeStamp(sample).seconds
  let pose = VNDetectHumanBodyPoseRequest()
  let text = VNRecognizeTextRequest(); text.recognitionLevel = .accurate; text.usesLanguageCorrection = false
  let full = args.count > 3 && args[3] == "full"
  text.regionOfInterest = full ? CGRect(x: 0, y: 0.1, width: 1, height: 0.6) : CGRect(x: 0, y: 0, width: 0.6, height: 0.12)
  let h = VNImageRequestHandler(cvPixelBuffer: pb, orientation: .up)
  try? h.perform([pose, text])
  var f: [String: Any] = ["t": t]
  f["text"] = (text.results ?? []).compactMap { $0.topCandidates(1).first?.string }
  var people: [[String: [Double]]] = []
  for ob in pose.results ?? [] {
    var j: [String: [Double]] = [:]
    for (n, k) in names { if let p = try? ob.recognizedPoint(k), p.confidence > 0.05 { j[n] = [Double(p.location.x) * size.width, (1 - Double(p.location.y)) * size.height, Double(p.confidence)] } }
    people.append(j)
  }
  f["people"] = people
  frames.append(f)
}
let data = try! JSONSerialization.data(withJSONObject: ["w": size.width, "h": size.height, "frames": frames])
try! data.write(to: URL(fileURLWithPath: args[2]))
print("frames", frames.count)
