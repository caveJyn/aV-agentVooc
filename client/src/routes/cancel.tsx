import { Link } from "react-router-dom";

export default function CancelPage() {
  return (
    <div className="p-4">
      <h1 className="text-2xl font-semibold">Payment Canceled</h1>
      <p>You canceled the payment.</p>
      <Link to="/home" className="text-blue-500">Return to Home</Link>
    </div>
  );
}