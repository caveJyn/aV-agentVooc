// Domain-separated Pedersen hash for Clerk userId
// private: clerk_id (Field)
// public: derived_user_id (Field)
fn main(clerk_id: Field) -> pub Field {
    let domain = [0x656c697a613a7573657249643a7631];  // "eliza:userId:v1"
    let derived = pedersen_hash([domain[0], clerk_id]);  // Or poseidon2 for privacy
    constrain derived == public_inputs[0];
    derived
}