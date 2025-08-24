import axios from 'axios';
import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import PriceSidebar from './PriceSidebar';
import Stepper from './Stepper';
import { useNavigate } from 'react-router-dom';
// import {
//     CardNumberElement,
//     CardCvcElement,
//     CardExpiryElement,
//     useStripe,
//     useElements,
// } from '@stripe/react-stripe-js';
import { clearErrors } from '../../actions/orderAction';
import { useSnackbar } from 'notistack';
import { post } from '../../utils/paytmForm';
import FormControl from '@mui/material/FormControl';
import FormControlLabel from '@mui/material/FormControlLabel';
import Radio from '@mui/material/Radio';
import RadioGroup from '@mui/material/RadioGroup';
import MetaData from '../Layouts/MetaData';


import { newOrder } from '../../actions/orderAction';
import { emptyCart } from '../../actions/cartAction';
import TextField from '@mui/material/TextField';

const Payment = () => {
    const navigate = useNavigate();
    const dispatch = useDispatch();
    // const navigate = useNavigate();
    const { enqueueSnackbar } = useSnackbar();
    // const stripe = useStripe();
    // const elements = useElements();
    // const paymentBtn = useRef(null);

    const [payDisable, setPayDisable] = useState(false);
    const [paymentMethod, setPaymentMethod] = useState('paytm');
    const [transactionId, setTransactionId] = useState('');
    const [paymentProof, setPaymentProof] = useState(null);

    const { shippingInfo, cartItems } = useSelector((state) => state.cart);
    const { user } = useSelector((state) => state.user);
    const { error } = useSelector((state) => state.newOrder);

    const totalPrice = cartItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);

    const paymentData = {
        amount: Math.round(totalPrice),
        email: user.email,
        phoneNo: shippingInfo.phoneNo,
    };

    // const order = {
    //     shippingInfo,
    //     orderItems: cartItems,
    //     totalPrice,
    // }

    const submitHandler = async (e) => {
        e.preventDefault();
        setPayDisable(true);

        let order = {
            shippingInfo,
            orderItems: cartItems,
            totalPrice,
            paymentMethod,
        };

        // Set paymentInfo for all methods
        if (paymentMethod === 'paytm') {
            // Old Paytm flow
            try {
                const config = {
                    headers: {
                        "Content-Type": "application/json",
                    },
                };
                const { data } = await axios.post(
                    '/api/v1/payment/process',
                    paymentData,
                    config,
                );
                let info = {
                    action: "https://securegw-stage.paytm.in/order/process",
                    params: data.paytmParams
                }
                post(info);
            } catch (error) {
                setPayDisable(false);
                enqueueSnackbar(error?.message || 'Payment failed', { variant: "error" });
            }
            return;
        }

        // For JazzCash, EasyPaisa, Bank
        if (['jazzcash', 'easypaisa', 'bank'].includes(paymentMethod)) {
            if (!transactionId || !paymentProof) {
                setPayDisable(false);
                enqueueSnackbar('Please provide Transaction ID and Payment Proof.', { variant: 'error' });
                return;
            }
            // Upload payment proof to Cloudinary
            try {
                // --- Cloudinary credentials ---
                const CLOUDINARY_UPLOAD_PRESET = process.env.CLOUDINARY_UPLOAD_PRESET; // <-- Replace with your Cloudinary upload preset
                const CLOUDINARY_CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME; // <-- Replace with your Cloudinary cloud name
                // ---
                let fileToUpload = paymentProof;
                // If user somehow uploads a base64 string, convert it to a File object (browser should prevent this, but just in case)
                if (!(fileToUpload instanceof File)) {
                    setPayDisable(false);
                    enqueueSnackbar('Invalid file. Please select a valid image file.', { variant: 'error' });
                    return;
                }
                const formData = new FormData();
                formData.append('file', fileToUpload);
                formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
                const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`, {
                    method: 'POST',
                    body: formData
                });
                const data = await res.json();
                if (!data.secure_url) throw new Error('Image upload failed');
                order.paymentProof = data.secure_url;
            } catch (err) {
                setPayDisable(false);
                enqueueSnackbar('Image upload failed. Please try again.', { variant: 'error' });
                return;
            }
            order.paymentInfo = {
                id: transactionId,
                status: 'PAID',
            };
        } else if (paymentMethod === 'cod') {
            order.paymentInfo = {
                id: 'COD',
                status: 'PENDING',
            };
        }

        try {
            await dispatch(newOrder(order));
            dispatch(emptyCart());
            navigate('/orders/success');
        } catch (error) {
            setPayDisable(false);
            enqueueSnackbar(error?.message || 'Order failed', { variant: "error" });
        }
    };

    useEffect(() => {
        if (error) {
            dispatch(clearErrors());
            enqueueSnackbar(error, { variant: "error" });
        }
    }, [dispatch, error, enqueueSnackbar]);


    return (
        <>
            <MetaData title="Flipkart: Secure Payment | Paytm" />

            <main className="w-full mt-20">

                {/* <!-- row --> */}
                <div className="flex flex-col sm:flex-row gap-3.5 w-full sm:w-11/12 mt-0 sm:mt-4 m-auto sm:mb-7">

                    {/* <!-- cart column --> */}
                    <div className="flex-1">

                        <Stepper activeStep={3}>
                            <div className="w-full bg-white">


                                <form onSubmit={submitHandler} autoComplete="off" className="flex flex-col justify-start gap-2 w-full mx-8 my-4 overflow-hidden">
                                    <FormControl>
                                        <RadioGroup
                                            aria-labelledby="payment-radio-group"
                                            value={paymentMethod}
                                            name="payment-radio-button"
                                            onChange={e => setPaymentMethod(e.target.value)}
                                        >
                                            <FormControlLabel
                                                value="paytm"
                                                control={<Radio />}
                                                label={<div className="flex items-center gap-4"><span>Paytm</span></div>}
                                            />
                                            <FormControlLabel
                                                value="jazzcash"
                                                control={<Radio />}
                                                label={<div className="flex items-center gap-4"><span>JazzCash</span></div>}
                                            />
                                            <FormControlLabel
                                                value="easypaisa"
                                                control={<Radio />}
                                                label={<div className="flex items-center gap-4"><span>EasyPaisa</span></div>}
                                            />
                                            <FormControlLabel
                                                value="bank"
                                                control={<Radio />}
                                                label={<div className="flex items-center gap-4"><span>Bank Account</span></div>}
                                            />
                                            <FormControlLabel
                                                value="cod"
                                                control={<Radio />}
                                                label={<div className="flex items-center gap-4"><span>Cash on Delivery</span></div>}
                                            />
                                        </RadioGroup>
                                    </FormControl>

                                    {/* Show TID and proof for non-COD, non-Paytm */}
                                    {['jazzcash', 'easypaisa', 'bank'].includes(paymentMethod) && (
                                        <>
                                            <TextField
                                                label="Transaction ID (TID)"
                                                variant="outlined"
                                                size="small"
                                                value={transactionId}
                                                onChange={e => setTransactionId(e.target.value)}
                                                required
                                                className="my-2"
                                            />
                                            <label className="my-2 font-medium">Upload Payment Proof Image:</label>
                                            <input
                                                type="file"
                                                accept="image/*"
                                                onChange={e => {
                                                    if (e.target.files && e.target.files[0]) {
                                                        setPaymentProof(e.target.files[0]);
                                                    } else {
                                                        setPaymentProof(null);
                                                    }
                                                }}
                                                required
                                            />
                                        </>
                                    )}

                                    <input type="submit" value={paymentMethod === 'cod' ? `Place Order` : `Pay ₹${totalPrice.toLocaleString()}`} disabled={payDisable ? true : false} className={`${payDisable ? "bg-primary-grey cursor-not-allowed" : "bg-primary-orange cursor-pointer"} w-1/2 sm:w-1/4 my-2 py-3 font-medium text-white shadow hover:shadow-lg rounded-sm uppercase outline-none`} />
                                </form>

                                {/* stripe form */}
                                {/* <form onSubmit={(e) => submitHandler(e)} autoComplete="off" className="flex flex-col justify-start gap-3 w-full sm:w-3/4 mx-8 my-4">
                                <div>
                                    <CardNumberElement />
                                </div>
                                <div>
                                    <CardExpiryElement />
                                </div>
                                <div>
                                    <CardCvcElement />
                                </div>
                                <input ref={paymentBtn} type="submit" value="Pay" className="bg-primary-orange w-full sm:w-1/3 my-2 py-3.5 text-sm font-medium text-white shadow hover:shadow-lg rounded-sm uppercase outline-none cursor-pointer" />
                            </form> */}
                                {/* stripe form */}

                            </div>
                        </Stepper>
                    </div>

                    <PriceSidebar cartItems={cartItems} />
                </div>
            </main>
        </>
    );
};

export default Payment;