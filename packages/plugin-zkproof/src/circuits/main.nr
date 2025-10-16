// Domain-separated Pedersen hash for Stripe customerId
// private: customer_id (Field)
// public: derived_customer_id (Field)
fn main(customer_id: Field) -> pub Field {
    let domain = [0x656c697a613a637573746f6d657249643a7631];  // "eliza:customerId:v1"
    let derived = pedersen_hash([domain[0], customer_id]);
    constrain derived == public_inputs[0];
    derived
}