// Placeholder for transaction proof
// private: tx_data (Field)
// public: tx_hash (Field)
fn main(tx_data: Field) -> pub Field {
    let domain = [0x656c697a613a7472616e73616374696f6e3a7631]; // "eliza:transaction:v1" in hex
    let derived = pedersen_hash([domain[0], tx_data]); // Or poseidon2 for privacy
    constrain derived == public_inputs[0];
    derived
}